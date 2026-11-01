package devPilot.backend.config;

import java.nio.charset.StandardCharsets;
import java.util.HexFormat;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.encrypt.Encryptors;
import org.springframework.security.crypto.encrypt.TextEncryptor;

@Configuration
public class CryptoConfig {

    @Bean
    TextEncryptor tokenEncryptor(
            @Value("${app.token-encryptor-password:codesense-secret-key-2026}") String password,
            @Value("${app.token-encryptor-salt:deadbeefcafe1234}") String salt) {
        String hexSalt = toValidHexSalt(salt);
        return Encryptors.text(password, hexSalt);
    }

    private String toValidHexSalt(String salt) {
        if (salt == null || salt.isBlank()) {
            return "deadbeefcafe1234";
        }
        String trimmed = salt.trim();
        if (trimmed.length() % 2 == 0 && trimmed.matches("^[0-9a-fA-F]+$")) {
            return trimmed;
        }
        return HexFormat.of().formatHex(trimmed.getBytes(StandardCharsets.UTF_8));
    }
}
