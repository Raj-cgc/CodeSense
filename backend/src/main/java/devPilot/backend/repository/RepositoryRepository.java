package devPilot.backend.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import devPilot.backend.entity.IndexStatus;
import devPilot.backend.entity.Repository;

public interface RepositoryRepository extends JpaRepository<Repository, UUID> {
    List<Repository> findByUserIdOrderByFullNameAsc(UUID userId);

    Optional<Repository> findByIdAndUserId(UUID id, UUID userId);

    Optional<Repository> findByUserIdAndGithubRepoId(UUID userId, Long githubRepoId);

    @Modifying
    @Transactional
    @Query("UPDATE Repository r SET r.indexStatus = :newStatus, r.errorMessage = :message WHERE r.indexStatus = :oldStatus")
    int updateStatusForOldStatus(
            @Param("oldStatus") IndexStatus oldStatus,
            @Param("newStatus") IndexStatus newStatus,
            @Param("message") String message);
}
