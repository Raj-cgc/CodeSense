package devPilot.backend.config;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;

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

import lombok.extern.slf4j.Slf4j;

@Configuration
@Slf4j
public class GeminiEmbeddingConfig {

    @Value("${spring.ai.google.genai.api-key:}")
    private String apiKey;

    @Value("${spring.ai.google.genai.embedding.text.model:text-embedding-004}")
    private String modelName;

    @Bean
    @Primary
    public EmbeddingModel geminiEmbeddingModel() {
        return new GeminiEmbeddingModel(apiKey, modelName);
    }

    public static class GeminiEmbeddingModel extends AbstractEmbeddingModel {

        private static final int DIMENSIONS = 3072;
        // gemini-embedding-001 uses embedContent on /v1 (NOT /v1beta)
        private static final String BASE_URL = "https://generativelanguage.googleapis.com/v1";

        private final String apiKey;
        private final String model;
        private final RestClient restClient;

        public GeminiEmbeddingModel(String apiKey, String model) {
            this.apiKey = apiKey;
            this.model = model != null && !model.isBlank() ? model : "gemini-embedding-001";
            this.restClient = RestClient.builder().baseUrl(BASE_URL).build();
        }

        @Override
        public float[] embed(Document document) {
            return embed(document.getText());
        }

        @Override
        public float[] embed(String text) {
            List<float[]> embeddings = embed(List.of(text));
            return embeddings.isEmpty() ? new float[DIMENSIONS] : embeddings.get(0);
        }

        @Override
        public List<float[]> embed(List<String> texts) {
            if (texts == null || texts.isEmpty()) {
                return Collections.emptyList();
            }

            List<float[]> results = new ArrayList<>(texts.size());
            for (String text : texts) {
                results.add(fetchSingleEmbedding(text));
            }
            return results;
        }

        /**
         * Uses the embedContent endpoint which is supported by text-embedding-004.
         * batchEmbedContents is NOT supported by text-embedding-004.
         */
        @SuppressWarnings("unchecked")
        private float[] fetchSingleEmbedding(String text) {
            Map<String, Object> body = Map.of(
                    "model", "models/" + model,
                    "content", Map.of("parts", List.of(Map.of("text", text != null ? text : "")))
            );

            try {
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
                        float[] fa = new float[values.size()];
                        for (int idx = 0; idx < values.size(); idx++) {
                            fa[idx] = values.get(idx).floatValue();
                        }
                        return fa;
                    }
                }
            } catch (Exception ex) {
                log.error("Failed to generate Gemini embedding for text chunk", ex);
                throw new RuntimeException("Failed to generate embeddings from Gemini API: " + ex.getMessage(), ex);
            }

            return new float[DIMENSIONS];
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
            return DIMENSIONS;
        }
    }
}
