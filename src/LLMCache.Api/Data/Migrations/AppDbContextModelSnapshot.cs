using System;
using System.Collections.Generic;
using LLMCache.Api.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;
using Pgvector;

#nullable disable

namespace LLMCache.Api.Data.Migrations
{
    [DbContext(typeof(AppDbContext))]
    partial class AppDbContextModelSnapshot : ModelSnapshot
    {
        protected override void BuildModel(ModelBuilder modelBuilder)
        {
#pragma warning disable 612, 618
            modelBuilder
                .HasAnnotation("ProductVersion", "9.0.0")
                .HasAnnotation("Relational:MaxIdentifierLength", 63);

            NpgsqlModelBuilderExtensions.HasPostgresExtension(modelBuilder, "vector");
            NpgsqlModelBuilderExtensions.UseIdentityByDefaultColumns(modelBuilder);

            modelBuilder.Entity("LLMCache.Api.Models.Snippet", b =>
            {
                b.Property<Guid>("Id").ValueGeneratedOnAdd().HasColumnType("uuid");
                b.Property<string>("Code").IsRequired().HasColumnType("text");
                b.Property<string>("Constraints").IsRequired().HasMaxLength(2000).HasColumnType("character varying(2000)");
                b.Property<DateTime>("CreatedAt").HasColumnType("timestamp with time zone");
                b.Property<string>("Intent").IsRequired().HasMaxLength(1000).HasColumnType("character varying(1000)");
                b.Property<bool>("IsPublic").HasColumnType("boolean");
                b.Property<int>("LineCount").HasColumnType("integer");
                b.Property<string>("Prompt").IsRequired().HasMaxLength(2000).HasColumnType("character varying(2000)");
                b.Property<List<string>>("Tags").IsRequired().HasColumnType("text[]");
                b.Property<DateTime>("UpdatedAt").HasColumnType("timestamp with time zone");
                b.Property<Guid>("UserId").HasColumnType("uuid");
                b.HasKey("Id");
                b.HasIndex("CreatedAt");
                b.HasIndex("IsPublic");
                b.HasIndex("UserId");
                b.ToTable("Snippets");

                b.OwnsOne("LLMCache.Api.Models.SnippetEnvironment", "Environment", b1 =>
                {
                    b1.Property<Guid>("SnippetId").HasColumnType("uuid");
                    b1.HasKey("SnippetId");
                    b1.ToTable("Snippets");
                    b1.ToJson("Environment");
                    b1.WithOwner().HasForeignKey("SnippetId");
                    b1.Property<string>("BuildTool").HasColumnType("text");
                    b1.Property<Dictionary<string, string>>("CustomMetadata").IsRequired().HasColumnType("text");
                    b1.Property<string>("Framework").HasColumnType("text");
                    b1.Property<string>("FrameworkVersion").HasColumnType("text");
                    b1.Property<List<string>>("KeyDependencies").IsRequired().HasColumnType("text");
                    b1.Property<string>("Language").HasColumnType("text");
                    b1.Property<string>("LanguageVersion").HasColumnType("text");
                    b1.Property<string>("OperatingSystem").HasColumnType("text");
                    b1.Property<string>("PackageManager").HasColumnType("text");
                    b1.Property<string>("RuntimeVersion").HasColumnType("text");
                    b1.Property<bool?>("StrictMode").HasColumnType("boolean");
                    b1.Property<string>("TargetPlatform").HasColumnType("text");
                });

                b.Navigation("Environment").IsRequired();
            });

            modelBuilder.Entity("LLMCache.Api.Models.SnippetEmbedding", b =>
            {
                b.Property<Guid>("Id").ValueGeneratedOnAdd().HasColumnType("uuid");
                b.Property<DateTime>("CreatedAt").HasColumnType("timestamp with time zone");
                b.Property<int>("Dimensions").HasColumnType("integer");
                b.Property<Vector>("EmbeddingVector").IsRequired().HasColumnType("vector(1536)");
                b.Property<string>("ModelName").IsRequired().HasColumnType("text");
                b.Property<Guid>("SnippetId").HasColumnType("uuid");
                b.HasKey("Id");
                b.HasIndex("SnippetId").IsUnique();
                b.HasIndex("EmbeddingVector")
                    .HasDatabaseName("IX_SnippetEmbeddings_EmbeddingVector")
                    .HasAnnotation("Npgsql:IndexMethod", "ivfflat")
                    .HasAnnotation("Npgsql:IndexOperators", new[] { "vector_cosine_ops" })
                    .HasAnnotation("Npgsql:StorageParameter:lists", 100);
                b.ToTable("SnippetEmbeddings");
            });

            modelBuilder.Entity("LLMCache.Api.Models.User", b =>
            {
                b.Property<Guid>("Id").ValueGeneratedOnAdd().HasColumnType("uuid");
                b.Property<DateTime>("CreatedAt").HasColumnType("timestamp with time zone");
                b.Property<string>("Email").IsRequired().HasMaxLength(254).HasColumnType("character varying(254)");
                b.Property<string>("Username").IsRequired().HasMaxLength(100).HasColumnType("character varying(100)");
                b.HasKey("Id");
                b.HasIndex("Email").IsUnique();
                b.ToTable("Users");
            });

            modelBuilder.Entity("LLMCache.Api.Models.Snippet", b =>
            {
                b.HasOne("LLMCache.Api.Models.User", "User")
                    .WithMany("Snippets")
                    .HasForeignKey("UserId")
                    .OnDelete(DeleteBehavior.Cascade)
                    .IsRequired();
                b.Navigation("User");
            });

            modelBuilder.Entity("LLMCache.Api.Models.SnippetEmbedding", b =>
            {
                b.HasOne("LLMCache.Api.Models.Snippet", "Snippet")
                    .WithOne("Embedding")
                    .HasForeignKey("LLMCache.Api.Models.SnippetEmbedding", "SnippetId")
                    .OnDelete(DeleteBehavior.Cascade)
                    .IsRequired();
                b.Navigation("Snippet");
            });

            modelBuilder.Entity("LLMCache.Api.Models.User", b =>
            {
                b.Navigation("Snippets");
            });

            modelBuilder.Entity("LLMCache.Api.Models.Snippet", b =>
            {
                b.Navigation("Embedding");
            });
#pragma warning restore 612, 618
        }
    }
}
