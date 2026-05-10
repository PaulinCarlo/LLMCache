using LLMCache.Api.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

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
            modelBuilder.HasPostgresExtension("vector");
        }

        ConfigureApplicationUser(modelBuilder);
        ConfigureCodeType(modelBuilder);
        ConfigureSnippetEnvironment(modelBuilder, isInMemory);
        ConfigureSnippet(modelBuilder, isInMemory);
        ConfigureSnippetEmbedding(modelBuilder, isInMemory);
    }

    private static void ConfigureApplicationUser(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<ApplicationUser>(entity =>
        {
            entity.Property(e => e.DisplayName).HasMaxLength(100);
            entity.Property(e => e.ProfilePictureUrl).HasMaxLength(500);
            entity.Property(e => e.OrganizationId).HasMaxLength(100);
        });
    }

    private static void ConfigureCodeType(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<CodeType>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(100);
            entity.HasIndex(e => e.Name).IsUnique();
        });
    }

    private static void ConfigureSnippetEnvironment(ModelBuilder modelBuilder, bool isInMemory)
    {
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
    }

    private static void ConfigureSnippet(ModelBuilder modelBuilder, bool isInMemory)
    {
        modelBuilder.Entity<Snippet>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Prompt).IsRequired().HasMaxLength(2000);
            entity.Property(e => e.Code).IsRequired();
            entity.Property(e => e.Intent).HasMaxLength(1000);
            entity.Property(e => e.Constraints).HasMaxLength(2000);
            
            if (!isInMemory)
            {
                entity.Property(e => e.Tags).HasColumnType("text[]");
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
            entity.HasIndex(e => e.VisibilityArea);
            entity.HasIndex(e => e.CreatedAt);
        });
    }

    private static void ConfigureSnippetEmbedding(ModelBuilder modelBuilder, bool isInMemory)
    {
        modelBuilder.Entity<SnippetEmbedding>(entity =>
        {
            entity.HasKey(e => e.Id);
            
            if (!isInMemory)
            {
                entity.Property(e => e.EmbeddingVector).HasColumnType("vector(1536)");
                entity.HasIndex(e => e.EmbeddingVector)
                    .HasMethod("hnsw")
                    .HasOperators("vector_cosine_ops")
                    .HasStorageParameter("m", 16)
                    .HasStorageParameter("ef_construction", 64);
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