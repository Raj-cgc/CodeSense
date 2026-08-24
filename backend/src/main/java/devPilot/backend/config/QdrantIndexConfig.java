package devPilot.backend.config;

import io.qdrant.client.QdrantClient;
import io.qdrant.client.grpc.Collections.PayloadSchemaType;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Creates required Qdrant payload indexes on startup.
 * Qdrant requires a keyword index on "repoId" before it can be used in filter
 * delete operations. Without the index, gRPC returns:
 * INVALID_ARGUMENT: Index required but not found for "repoId".
 */
@Configuration
@Slf4j
public class QdrantIndexConfig {

    @Value("${spring.ai.vectorstore.qdrant.collection-name:devpilot-code}")
    private String collectionName;

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
