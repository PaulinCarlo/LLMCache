using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LLMCache.Api.Migrations
{
    /// <inheritdoc />
    public partial class NormalizeSnippetEnvironment : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "EnvironmentId",
                table: "Snippets",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "CodeTypes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CodeTypes", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "SnippetEnvironments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CodeTypeId = table.Column<Guid>(type: "uuid", nullable: true),
                    LanguageVersion = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Framework = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    FrameworkVersion = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    RuntimeVersion = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    StrictMode = table.Column<bool>(type: "boolean", nullable: true),
                    PackageManager = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    KeyDependencies = table.Column<string>(type: "jsonb", nullable: false),
                    TargetPlatform = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    OperatingSystem = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    BuildTool = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    CustomMetadata = table.Column<string>(type: "jsonb", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SnippetEnvironments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SnippetEnvironments_CodeTypes_CodeTypeId",
                        column: x => x.CodeTypeId,
                        principalTable: "CodeTypes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.Sql(
                """
                INSERT INTO "CodeTypes" ("Id", "Name")
                SELECT DISTINCT
                    (
                        substring(md5(lower(trim("Environment"->>'Language'))) from 1 for 8) || '-' ||
                        substring(md5(lower(trim("Environment"->>'Language'))) from 9 for 4) || '-' ||
                        substring(md5(lower(trim("Environment"->>'Language'))) from 13 for 4) || '-' ||
                        substring(md5(lower(trim("Environment"->>'Language'))) from 17 for 4) || '-' ||
                        substring(md5(lower(trim("Environment"->>'Language'))) from 21 for 12)
                    )::uuid,
                    trim("Environment"->>'Language')
                FROM "Snippets"
                WHERE nullif(trim("Environment"->>'Language'), '') IS NOT NULL;
                """);

            migrationBuilder.Sql(
                """
                INSERT INTO "SnippetEnvironments" (
                    "Id",
                    "CodeTypeId",
                    "LanguageVersion",
                    "Framework",
                    "FrameworkVersion",
                    "RuntimeVersion",
                    "StrictMode",
                    "PackageManager",
                    "KeyDependencies",
                    "TargetPlatform",
                    "OperatingSystem",
                    "BuildTool",
                    "CustomMetadata")
                SELECT DISTINCT
                    (
                        substring(md5("Environment"::text) from 1 for 8) || '-' ||
                        substring(md5("Environment"::text) from 9 for 4) || '-' ||
                        substring(md5("Environment"::text) from 13 for 4) || '-' ||
                        substring(md5("Environment"::text) from 17 for 4) || '-' ||
                        substring(md5("Environment"::text) from 21 for 12)
                    )::uuid,
                    CASE
                        WHEN nullif(trim("Environment"->>'Language'), '') IS NULL THEN NULL
                        ELSE (
                            substring(md5(lower(trim("Environment"->>'Language'))) from 1 for 8) || '-' ||
                            substring(md5(lower(trim("Environment"->>'Language'))) from 9 for 4) || '-' ||
                            substring(md5(lower(trim("Environment"->>'Language'))) from 13 for 4) || '-' ||
                            substring(md5(lower(trim("Environment"->>'Language'))) from 17 for 4) || '-' ||
                            substring(md5(lower(trim("Environment"->>'Language'))) from 21 for 12)
                        )::uuid
                    END,
                    nullif("Environment"->>'LanguageVersion', ''),
                    nullif("Environment"->>'Framework', ''),
                    nullif("Environment"->>'FrameworkVersion', ''),
                    nullif("Environment"->>'RuntimeVersion', ''),
                    CASE
                        WHEN "Environment" ? 'StrictMode' THEN ("Environment"->>'StrictMode')::boolean
                        ELSE NULL
                    END,
                    nullif("Environment"->>'PackageManager', ''),
                    COALESCE("Environment"->'KeyDependencies', '[]'::jsonb),
                    nullif("Environment"->>'TargetPlatform', ''),
                    nullif("Environment"->>'OperatingSystem', ''),
                    nullif("Environment"->>'BuildTool', ''),
                    COALESCE("Environment"->'CustomMetadata', '{}'::jsonb)
                FROM "Snippets";
                """);

            migrationBuilder.Sql(
                """
                UPDATE "Snippets"
                SET "EnvironmentId" = (
                    substring(md5("Environment"::text) from 1 for 8) || '-' ||
                    substring(md5("Environment"::text) from 9 for 4) || '-' ||
                    substring(md5("Environment"::text) from 13 for 4) || '-' ||
                    substring(md5("Environment"::text) from 17 for 4) || '-' ||
                    substring(md5("Environment"::text) from 21 for 12)
                )::uuid;
                """);

            migrationBuilder.AlterColumn<Guid>(
                name: "EnvironmentId",
                table: "Snippets",
                type: "uuid",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Snippets_EnvironmentId",
                table: "Snippets",
                column: "EnvironmentId");

            migrationBuilder.CreateIndex(
                name: "IX_CodeTypes_Name",
                table: "CodeTypes",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SnippetEnvironments_CodeTypeId",
                table: "SnippetEnvironments",
                column: "CodeTypeId");

            migrationBuilder.AddForeignKey(
                name: "FK_Snippets_SnippetEnvironments_EnvironmentId",
                table: "Snippets",
                column: "EnvironmentId",
                principalTable: "SnippetEnvironments",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.DropColumn(
                name: "Environment",
                table: "Snippets");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Snippets_SnippetEnvironments_EnvironmentId",
                table: "Snippets");

            migrationBuilder.AddColumn<string>(
                name: "Environment",
                table: "Snippets",
                type: "jsonb",
                nullable: false,
                defaultValue: "{}");

            migrationBuilder.Sql(
                """
                UPDATE "Snippets" AS s
                SET "Environment" = jsonb_strip_nulls(
                    jsonb_build_object(
                        'Language', ct."Name",
                        'LanguageVersion', env."LanguageVersion",
                        'Framework', env."Framework",
                        'FrameworkVersion', env."FrameworkVersion",
                        'RuntimeVersion', env."RuntimeVersion",
                        'StrictMode', env."StrictMode",
                        'PackageManager', env."PackageManager",
                        'KeyDependencies', COALESCE(env."KeyDependencies", '[]'::jsonb),
                        'TargetPlatform', env."TargetPlatform",
                        'OperatingSystem', env."OperatingSystem",
                        'BuildTool', env."BuildTool",
                        'CustomMetadata', COALESCE(env."CustomMetadata", '{}'::jsonb)
                    )
                )
                FROM "SnippetEnvironments" AS env
                LEFT JOIN "CodeTypes" AS ct ON ct."Id" = env."CodeTypeId"
                WHERE s."EnvironmentId" = env."Id";
                """);

            migrationBuilder.DropTable(
                name: "SnippetEnvironments");

            migrationBuilder.DropTable(
                name: "CodeTypes");

            migrationBuilder.DropIndex(
                name: "IX_Snippets_EnvironmentId",
                table: "Snippets");

            migrationBuilder.DropColumn(
                name: "EnvironmentId",
                table: "Snippets");
        }
    }
}
