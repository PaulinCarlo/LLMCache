using System.Text.Json;
using LLMCache.Api.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore;
using Pgvector.EntityFrameworkCore;

namespace LLMCache.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options)
    : IdentityDbContext<ApplicationUser, IdentityRole<Guid>, Guid>(options)
{
    public DbSet<CodeType> CodeTypes => Set<CodeType>();
    public DbSet<Snippet> Snippets => Set<Snippet>();
    public DbSet<SnippetEmbedding> SnippetEmbeddings => Set<SnippetEmbedding>();
    public DbSet<SnippetEnvironment> SnippetEnvironments => Set<SnippetEnvironment>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        var isInMemory = Database.ProviderName == "Microsoft.EntityFrameworkCore.InMemory";

        if (!isInMemory)
        {
            modelBuilder.HasPostgresExtension("hstore");
            modelBuilder.HasPostgresExtension("vector");
        }

        var keyDependenciesComparer = new ValueComparer<List<string>>(
            (left, right) => SequenceEqual(left, right),
            values => GetSequenceHashCode(values),
            values => CloneList(values));

        var customMetadataComparer = new ValueComparer<Dictionary<string, string>>(
            (left, right) => DictionaryEqual(left, right),
            values => GetDictionaryHashCode(values),
            values => CloneDictionary(values));

        modelBuilder.Entity<ApplicationUser>(entity =>
        {
            entity.Property(e => e.DisplayName).HasMaxLength(100);
            entity.Property(e => e.ProfilePictureUrl).HasMaxLength(500);
            entity.Property(e => e.OrganizationId).HasMaxLength(100);
        });

        modelBuilder.Entity<CodeType>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(100);
            entity.HasIndex(e => e.Name).IsUnique();
        });

        modelBuilder.Entity<SnippetEnvironment>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.LanguageVersion).HasMaxLength(100);
            entity.Property(e => e.Framework).HasMaxLength(100);
            entity.Property(e => e.FrameworkVersion).HasMaxLength(100);
            entity.Property(e => e.RuntimeVersion).HasMaxLength(100);
            entity.Property(e => e.PackageManager).HasMaxLength(100);
            entity.Property(e => e.TargetPlatform).HasMaxLength(100);
            entity.Property(e => e.OperatingSystem).HasMaxLength(100);
            entity.Property(e => e.BuildTool).HasMaxLength(100);
            entity.Property(e => e.KeyDependencies)
                .HasConversion(
                    v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
                    v => JsonSerializer.Deserialize<List<string>>(v, (JsonSerializerOptions?)null) ?? new List<string>())
                .Metadata.SetValueComparer(keyDependenciesComparer);
            entity.Property(e => e.CustomMetadata)
                .HasConversion(
                    v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
                    v => JsonSerializer.Deserialize<Dictionary<string, string>>(v, (JsonSerializerOptions?)null) ?? new Dictionary<string, string>())
                .Metadata.SetValueComparer(customMetadataComparer);

            if (!isInMemory)
            {
                entity.Property(e => e.KeyDependencies).HasColumnType("jsonb");
                entity.Property(e => e.CustomMetadata).HasColumnType("jsonb");
            }

            entity.HasOne(e => e.CodeType)
                .WithMany(c => c.SnippetEnvironments)
                .HasForeignKey(e => e.CodeTypeId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasIndex(e => e.CodeTypeId);
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
                entity.Property(e => e.Tags)
                      .HasColumnType("text[]");
            }
            entity.HasOne(e => e.User)
                  .WithMany(u => u.Snippets)
                  .HasForeignKey(e => e.UserId)
                  .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(e => e.Environment)
                  .WithMany(env => env.Snippets)
                  .HasForeignKey(e => e.EnvironmentId)
                  .OnDelete(DeleteBehavior.Restrict);
            entity.HasIndex(e => e.UserId);
            entity.HasIndex(e => e.EnvironmentId);
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

    private static List<string> CloneList(List<string>? values) =>
        values?.ToList() ?? new List<string>();

    private static Dictionary<string, string> CloneDictionary(Dictionary<string, string>? values) =>
        values?.ToDictionary(kvp => kvp.Key, kvp => kvp.Value) ?? new Dictionary<string, string>();

    private static bool SequenceEqual(List<string>? left, List<string>? right) =>
        (left ?? new List<string>()).SequenceEqual(right ?? new List<string>());

    private static int GetSequenceHashCode(List<string>? values) =>
        (values ?? new List<string>()).Aggregate(0, HashCode.Combine);

    private static bool DictionaryEqual(Dictionary<string, string>? left, Dictionary<string, string>? right)
    {
        if (ReferenceEquals(left, right))
        {
            return true;
        }

        if (left is null || right is null || left.Count != right.Count)
        {
            return false;
        }

        return left.OrderBy(kvp => kvp.Key)
            .SequenceEqual(right.OrderBy(kvp => kvp.Key));
    }

    private static int GetDictionaryHashCode(Dictionary<string, string>? values) =>
        (values ?? new Dictionary<string, string>())
            .OrderBy(kvp => kvp.Key)
            .Aggregate(0, (hash, kvp) => HashCode.Combine(hash, kvp.Key, kvp.Value));
}
