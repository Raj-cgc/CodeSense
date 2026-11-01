package devPilot.backend.config;

import io.qdrant.client.QdrantClient;
import io.qdrant.client.QdrantGrpcClient;
import io.qdrant.client.grpc.Collections.PayloadSchemaType;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

/**
 * Creates required Qdrant payload indexes on startup.
 * Qdrant requires a keyword index on "repoId" before it can be used in filter
 * delete operations. Without the index, gRPC returns:
 * INVALID_ARGUMENT: Index required but not found for "repoId".
 */
@Configuration
@Slf4j
public class QdrantIndexConfig {

    @Value("${spring.ai.vectorstore.qdrant.collection-name:codesense-code}")
    private String collectionName;

    @Bean
    @Primary
    public QdrantClient qdrantClient(
            @Value("${spring.ai.vectorstore.qdrant.host:localhost}") String host,
            @Value("${spring.ai.vectorstore.qdrant.port:6334}") int port,
            @Value("${spring.ai.vectorstore.qdrant.api-key:}") String apiKey,
            @Value("${spring.ai.vectorstore.qdrant.use-tls:true}") boolean useTls) {
        
        String cleanHost = sanitizeHost(host);
        var grpcBuilder = QdrantGrpcClient.newBuilder(cleanHost, port, useTls);
        if (apiKey != null && !apiKey.isBlank() && !"your_qdrant_api_key".equals(apiKey)) {
            grpcBuilder.withApiKey(apiKey);
        }
        return new QdrantClient(grpcBuilder.build());
    }

    public static String sanitizeHost(String host) {
        if (host == null || host.isBlank()) {
            return "localhost";
        }
        String cleaned = host.trim();
        if (cleaned.startsWith("https://")) {
            cleaned = cleaned.substring(8);
        } else if (cleaned.startsWith("http://")) {
            cleaned = cleaned.substring(7);
        }
        if (cleaned.contains(":")) {
            cleaned = cleaned.substring(0, cleaned.indexOf(':'));
        }
        if (cleaned.endsWith("/")) {
            cleaned = cleaned.substring(0, cleaned.length() - 1);
        }
        return cleaned;
    }

    @Bean
    public ApplicationRunner createQdrantIndexes(QdrantClient qdrantClient) {
        return args -> {
            try {
                qdrantClient.createPayloadIndexAsync(
                        collectionName,
                        "repoId",
                        PayloadSchemaType.Keyword,
                        null,
                        null,
                        null,
                        null
                ).get();
                log.info("Qdrant: ensured keyword index on 'repoId' in collection '{}'", collectionName);
            } catch (Exception e) {
                String msg = e.getMessage() != null ? e.getMessage() : "";
                if (msg.contains("already exists") || msg.contains("ALREADY_EXISTS")) {
                    log.info("Qdrant: 'repoId' index already exists in collection '{}'", collectionName);
                } else {
                    log.warn("Qdrant: could not create 'repoId' index in '{}': {}", collectionName, msg);
                }
            }
        };
    }
}
