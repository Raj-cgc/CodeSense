package devPilot.backend.config;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.springframework.ai.document.Document;
import org.springframework.ai.embedding.AbstractEmbeddingModel;
import org.springframework.ai.embedding.Embedding;
import org.springframework.ai.embedding.EmbeddingModel;
import org.springframework.ai.embedding.EmbeddingRequest;
import org.springframework.ai.embedding.EmbeddingResponse;
import org.springframework.ai.embedding.EmbeddingResponseMetadata;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import lombok.extern.slf4j.Slf4j;

@Configuration
@Slf4j
public class GeminiEmbeddingConfig {

    @Value("${spring.ai.google.genai.api-key:}")
    private String apiKey;

    @Value("${spring.ai.google.genai.embedding.text.model:gemini-embedding-001}")
    private String modelName;

    @Value("${spring.ai.google.genai.embedding.text.dimensions:768}")
    private Integer outputDimensions;

    @Bean
    @Primary
    public EmbeddingModel geminiEmbeddingModel() {
        return new GeminiEmbeddingModel(apiKey, modelName, outputDimensions);
    }

    public static class GeminiEmbeddingModel extends AbstractEmbeddingModel {

        private static final int DEFAULT_DIMENSIONS = 768;
        private static final int MAX_BATCH_SIZE = 50;
        private static final int MAX_RETRIES = 8;
        private static final Pattern RETRY_DELAY_PATTERN = Pattern.compile("retry(?:Delay\"?\\s*:\\s*\"?|\\s+in\\s+)(\\d+(?:\\.\\d+)?)\\s*s", Pattern.CASE_INSENSITIVE);

        private static final String BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

        private final String apiKey;
        private final String model;
        private final Integer outputDimensions;
        private final RestClient restClient;
        private volatile int detectedDimensions;

        public GeminiEmbeddingModel(String apiKey, String model, Integer outputDimensions) {
            this.apiKey = apiKey;
            String sanitized = model != null && !model.isBlank() ? model.trim() : "gemini-embedding-001";
            if (sanitized.startsWith("models/")) {
                sanitized = sanitized.substring(7);
            }
            this.model = sanitized;
            this.outputDimensions = (outputDimensions != null && outputDimensions > 0) ? outputDimensions : DEFAULT_DIMENSIONS;
            this.restClient = RestClient.builder().baseUrl(BASE_URL).build();
            this.detectedDimensions = this.outputDimensions;
        }

        public GeminiEmbeddingModel(String apiKey, String model) {
            this(apiKey, model, DEFAULT_DIMENSIONS);
        }

        @Override
        public float[] embed(Document document) {
            return embed(document.getText());
        }

        @Override
        public float[] embed(String text) {
            List<float[]> embeddings = embed(List.of(text));
            return embeddings.isEmpty() ? new float[dimensions()] : embeddings.get(0);
        }

        @Override
        public List<float[]> embed(List<String> texts) {
            if (texts == null || texts.isEmpty()) {
                return Collections.emptyList();
            }

            List<float[]> results = new ArrayList<>(texts.size());
            for (int i = 0; i < texts.size(); i += MAX_BATCH_SIZE) {
                int toIndex = Math.min(i + MAX_BATCH_SIZE, texts.size());
                List<String> subList = texts.subList(i, toIndex);
                results.addAll(fetchBatchEmbeddingsWithRetry(subList));
            }
            return results;
        }

        private List<float[]> fetchBatchEmbeddingsWithRetry(List<String> texts) {
            for (int attempt = 0; attempt < MAX_RETRIES; attempt++) {
                try {
                    return fetchBatchEmbeddings(texts);
                } catch (Exception ex) {
                    boolean isLastAttempt = (attempt == MAX_RETRIES - 1);
                    long delayMs = calculateRetryDelayMs(attempt, ex);

                    if (isRetryable(ex) && !isLastAttempt) {
                        log.warn("Gemini embedding rate limit hit (429/Resource Exhausted). Waiting {} ms before retry (attempt {}/{})",
                                delayMs, attempt + 1, MAX_RETRIES);
                        try {
                            Thread.sleep(delayMs);
                        } catch (InterruptedException ie) {
                            Thread.currentThread().interrupt();
                            throw new RuntimeException("Embedding retry interrupted", ie);
                        }
                    } else {
                        log.error("Failed to generate Gemini batch embeddings after attempt {}/{}: {}", attempt + 1, MAX_RETRIES, ex.getMessage());
                        if (!isLastAttempt && isRetryable(ex)) {
                            try {
                                return fetchSingleEmbeddingsFallback(texts);
                            } catch (Exception fallbackEx) {
                                log.warn("Fallback to single embeddings also failed: {}", fallbackEx.getMessage());
                            }
                        }
                        throw new RuntimeException("Failed to generate embeddings from Gemini API: " + ex.getMessage(), ex);
                    }
                }
            }
            throw new RuntimeException("Failed to generate embeddings from Gemini API after retries");
        }

        @SuppressWarnings("unchecked")
        private List<float[]> fetchBatchEmbeddings(List<String> texts) {
            List<Map<String, Object>> requestsList = new ArrayList<>(texts.size());
            for (String text : texts) {
                Map<String, Object> reqItem = new java.util.HashMap<>();
                reqItem.put("model", "models/" + model);
                reqItem.put("content", Map.of("parts", List.of(Map.of("text", text != null ? text : ""))));
                if (outputDimensions != null && outputDimensions > 0) {
                    reqItem.put("outputDimensionality", outputDimensions);
                }
                requestsList.add(reqItem);
            }

            Map<String, Object> body = Map.of("requests", requestsList);

            Map<String, Object> response = restClient.post()
                    .uri(uriBuilder -> uriBuilder
                            .path("/models/" + model + ":batchEmbedContents")
                            .queryParam("key", apiKey)
                            .build())
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(Map.class);

            if (response != null && response.containsKey("embeddings")) {
                List<Map<String, Object>> embeddingsList = (List<Map<String, Object>>) response.get("embeddings");
                List<float[]> result = new ArrayList<>(embeddingsList.size());
                for (Map<String, Object> embItem : embeddingsList) {
                    List<Number> values = (List<Number>) embItem.get("values");
                    if (values != null) {
                        float[] fa = toFloatArray(values);
                        if (fa.length > 0) {
                            this.detectedDimensions = fa.length;
                        }
                        result.add(fa);
                    } else {
                        result.add(new float[dimensions()]);
                    }
                }
                return result;
            }

            throw new RuntimeException("No 'embeddings' array in Gemini API response: " + response);
        }

        private List<float[]> fetchSingleEmbeddingsFallback(List<String> texts) {
            List<float[]> results = new ArrayList<>(texts.size());
            for (String text : texts) {
                results.add(fetchSingleEmbeddingWithRetry(text));
            }
            return results;
        }

        private float[] fetchSingleEmbeddingWithRetry(String text) {
            for (int attempt = 0; attempt < MAX_RETRIES; attempt++) {
                try {
                    return fetchSingleEmbedding(text);
                } catch (Exception ex) {
                    boolean isLastAttempt = (attempt == MAX_RETRIES - 1);
                    long delayMs = calculateRetryDelayMs(attempt, ex);

                    if (isRetryable(ex) && !isLastAttempt) {
                        log.warn("Gemini single embedding rate limit hit (429). Waiting {} ms before retry (attempt {}/{})",
                                delayMs, attempt + 1, MAX_RETRIES);
                        try {
                            Thread.sleep(delayMs);
                        } catch (InterruptedException ie) {
                            Thread.currentThread().interrupt();
                            throw new RuntimeException("Embedding retry interrupted", ie);
                        }
                    } else {
                        throw ex;
                    }
                }
            }
            return new float[dimensions()];
        }

        @SuppressWarnings("unchecked")
        private float[] fetchSingleEmbedding(String text) {
            Map<String, Object> body = new java.util.HashMap<>();
            body.put("model", "models/" + model);
            body.put("content", Map.of("parts", List.of(Map.of("text", text != null ? text : ""))));
            if (outputDimensions != null && outputDimensions > 0) {
                body.put("outputDimensionality", outputDimensions);
            }

            Map<String, Object> response = restClient.post()
                    .uri(uriBuilder -> uriBuilder
                            .path("/models/" + model + ":embedContent")
                            .queryParam("key", apiKey)
                            .build())
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(Map.class);

            if (response != null && response.containsKey("embedding")) {
                Map<String, Object> embeddingObj = (Map<String, Object>) response.get("embedding");
                List<Number> values = (List<Number>) embeddingObj.get("values");
                if (values != null) {
                    float[] fa = toFloatArray(values);
                    if (fa.length > 0) {
                        this.detectedDimensions = fa.length;
                    }
                    return fa;
                }
            }

            return new float[dimensions()];
        }

        private float[] toFloatArray(List<Number> values) {
            float[] fa = new float[values.size()];
            for (int idx = 0; idx < values.size(); idx++) {
                fa[idx] = values.get(idx).floatValue();
            }
            return fa;
        }

        private boolean isRetryable(Exception ex) {
            String msg = ex.getMessage() != null ? ex.getMessage().toLowerCase() : "";
            return msg.contains("429") ||
                   msg.contains("too many requests") ||
                   msg.contains("resource_exhausted") ||
                   msg.contains("quota exceeded") ||
                   msg.contains("503") ||
                   msg.contains("500") ||
                   ex instanceof RestClientResponseException;
        }

        private long calculateRetryDelayMs(int attempt, Exception ex) {
            String errorDetails = ex.getMessage() != null ? ex.getMessage() : "";
            if (ex instanceof RestClientResponseException rce) {
                errorDetails += " " + rce.getResponseBodyAsString();
            }

            Matcher matcher = RETRY_DELAY_PATTERN.matcher(errorDetails);
            if (matcher.find()) {
                try {
                    double seconds = Double.parseDouble(matcher.group(1));
                    return Math.max((long) (seconds * 1000) + 1500, 3000L);
                } catch (Exception ignored) {
                }
            }

            // Exponential backoff: 3s, 6s, 12s, 24s, 48s + jitter
            long baseDelay = 3000L * (1L << Math.min(attempt, 5));
            long jitter = (long) (Math.random() * 1500);
            return Math.min(baseDelay + jitter, 60000L);
        }

        @Override
        public EmbeddingResponse call(EmbeddingRequest request) {
            List<String> texts = request.getInstructions();
            List<float[]> vectors = embed(texts);
            List<Embedding> embeddings = new ArrayList<>();
            for (int i = 0; i < vectors.size(); i++) {
                embeddings.add(new Embedding(vectors.get(i), i));
            }
            return new EmbeddingResponse(embeddings, new EmbeddingResponseMetadata());
        }

        @Override
        public int dimensions() {
            if (outputDimensions != null && outputDimensions > 0) {
                return outputDimensions;
            }
            return detectedDimensions > 0 ? detectedDimensions : DEFAULT_DIMENSIONS;
        }
    }
}
