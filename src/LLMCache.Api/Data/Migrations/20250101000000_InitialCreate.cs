using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;
using Pgvector;

#nullable disable

namespace LLMCache.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterDatabase()
                .Annotation("Npgsql:PostgresExtension:vector", ",,");

            migrationBuilder.CreateTable(
                name: "Users",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Email = table.Column<string>(type: "character varying(254)", maxLength: 254, nullable: false),
                    Username = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Users", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Snippets",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Prompt = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    Code = table.Column<string>(type: "text", nullable: false),
                    LineCount = table.Column<int>(type: "integer", nullable: false),
                    Intent = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    Constraints = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    Environment = table.Column<string>(type: "jsonb", nullable: false),
                    Tags = table.Column<List<string>>(type: "text[]", nullable: false),
                    IsPublic = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Snippets", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Snippets_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SnippetEmbeddings",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    SnippetId = table.Column<Guid>(type: "uuid", nullable: false),
                    EmbeddingVector = table.Column<Vector>(type: "vector(1536)", nullable: false),
                    ModelName = table.Column<string>(type: "text", nullable: false),
                    Dimensions = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SnippetEmbeddings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SnippetEmbeddings_Snippets_SnippetId",
                        column: x => x.SnippetId,
                        principalTable: "Snippets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Snippets_CreatedAt",
                table: "Snippets",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_Snippets_IsPublic",
                table: "Snippets",
                column: "IsPublic");

            migrationBuilder.CreateIndex(
                name: "IX_Snippets_UserId",
                table: "Snippets",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_Users_Email",
                table: "Users",
                column: "Email",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SnippetEmbeddings_SnippetId",
                table: "SnippetEmbeddings",
                column: "SnippetId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SnippetEmbeddings_EmbeddingVector",
                table: "SnippetEmbeddings",
                column: "EmbeddingVector")
                .Annotation("Npgsql:IndexMethod", "ivfflat")
                .Annotation("Npgsql:IndexOperators", new[] { "vector_cosine_ops" })
                .Annotation("Npgsql:StorageParameter:lists", 100);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "SnippetEmbeddings");
            migrationBuilder.DropTable(name: "Snippets");
            migrationBuilder.DropTable(name: "Users");
        }
    }
}
