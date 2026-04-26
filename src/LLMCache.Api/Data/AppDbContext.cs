using Microsoft.EntityFrameworkCore;
using LLMCache.Api.Models;
using Pgvector.EntityFrameworkCore;

namespace LLMCache.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Snippet> Snippets => Set<Snippet>();
    public DbSet<SnippetEmbedding> SnippetEmbeddings => Set<SnippetEmbedding>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        var isInMemory = Database.ProviderName == "Microsoft.EntityFrameworkCore.InMemory";

        if (!isInMemory)
        {
            modelBuilder.HasPostgresExtension("vector");
        }

        modelBuilder.Entity<User>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.Email).IsUnique();
            entity.Property(e => e.Email).IsRequired().HasMaxLength(254);
            entity.Property(e => e.Username).IsRequired().HasMaxLength(100);
        });

        modelBuilder.Entity<Snippet>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Prompt).IsRequired().HasMaxLength(2000);
            entity.Property(e => e.Code).IsRequired();
            entity.Property(e => e.Intent).HasMaxLength(1000);
            entity.Property(e => e.Constraints).HasMaxLength(2000);
            if (!isInMemory)
            {
                entity.OwnsOne(e => e.Environment, env =>
                {
                    env.ToJson();
                });
                entity.Property(e => e.Tags)
                      .HasColumnType("text[]");
            }
            else
            {
                entity.OwnsOne(e => e.Environment, env =>
                {
                    env.Property(e => e.KeyDependencies)
                        .HasConversion(
                            v => System.Text.Json.JsonSerializer.Serialize(v, (System.Text.Json.JsonSerializerOptions?)null),
                            v => System.Text.Json.JsonSerializer.Deserialize<List<string>>(v, (System.Text.Json.JsonSerializerOptions?)null) ?? new()
                        );
                    env.Property(e => e.CustomMetadata)
                        .HasConversion(
                            v => System.Text.Json.JsonSerializer.Serialize(v, (System.Text.Json.JsonSerializerOptions?)null),
                            v => System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, string>>(v, (System.Text.Json.JsonSerializerOptions?)null) ?? new()
                        );
                });
            }
            entity.HasOne(e => e.User)
                  .WithMany(u => u.Snippets)
                  .HasForeignKey(e => e.UserId)
                  .OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(e => e.UserId);
            entity.HasIndex(e => e.IsPublic);
            entity.HasIndex(e => e.CreatedAt);
        });

        modelBuilder.Entity<SnippetEmbedding>(entity =>
        {
            entity.HasKey(e => e.Id);
            if (!isInMemory)
            {
                entity.Property(e => e.EmbeddingVector).HasColumnType("vector(1536)");
                entity.HasIndex(e => e.EmbeddingVector)
                      .HasMethod("ivfflat")
                      .HasOperators("vector_cosine_ops")
                      .HasStorageParameter("lists", 100);
            }
            else
            {
                entity.Ignore(e => e.EmbeddingVector);
            }
            entity.HasOne(e => e.Snippet)
                  .WithOne(s => s.Embedding)
                  .HasForeignKey<SnippetEmbedding>(e => e.SnippetId)
                  .OnDelete(DeleteBehavior.Cascade);
        });
    }
}
