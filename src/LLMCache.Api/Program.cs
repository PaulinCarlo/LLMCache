using System.Text;
using LLMCache.Api.Data;
using LLMCache.Api.Models;
using LLMCache.Api.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

// ──────────────────────────────────────────────────────────────
// Database
// ──────────────────────────────────────────────────────────────
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(
        builder.Configuration.GetConnectionString("DefaultConnection"),
        o => o.UseVector()));

// ──────────────────────────────────────────────────────────────
// ASP.NET Core Identity  (users, roles, claims)
// ──────────────────────────────────────────────────────────────
builder.Services.AddIdentity<ApplicationUser, IdentityRole<Guid>>(options =>
    {
        options.Password.RequireDigit = true;
        options.Password.RequiredLength = 8;
        options.Password.RequireNonAlphanumeric = false;
        options.Password.RequireUppercase = true;
        options.Password.RequireLowercase = true;

        options.User.RequireUniqueEmail = true;

        // Lockout after 5 failed attempts for 5 minutes
        options.Lockout.MaxFailedAccessAttempts = 5;
        options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(5);

        // ── EMAIL CONFIRMATION ─────────────────────────────────
        // Uncomment when an email sender is wired up
        // options.SignIn.RequireConfirmedEmail = true;
        // ──────────────────────────────────────────────────────
    })
    .AddEntityFrameworkStores<AppDbContext>()
    .AddDefaultTokenProviders();

// ──────────────────────────────────────────────────────────────
// JWT Bearer authentication
// ──────────────────────────────────────────────────────────────
var jwtSettings = builder.Configuration.GetSection("Jwt");
var jwtKey = jwtSettings["Key"] ?? throw new InvalidOperationException("Jwt:Key is not configured.");

builder.Services.AddAuthentication(options =>
    {
        options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
        options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
    })
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwtSettings["Issuer"],
            ValidateAudience = true,
            ValidAudience = jwtSettings["Audience"],
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey))
        };
    })

    // ── SOCIAL LOGINS ──────────────────────────────────────────
    // Configure each provider in appsettings.json or user-secrets.
    // Remove the leading // on each block to activate.
    // ──────────────────────────────────────────────────────────

    // Google
    .AddGoogle(options =>
    {
        options.ClientId = builder.Configuration["Authentication:Google:ClientId"] ?? "";
        options.ClientSecret = builder.Configuration["Authentication:Google:ClientSecret"] ?? "";
    })

    // GitHub
    .AddGitHub(options =>
    {
        options.ClientId = builder.Configuration["Authentication:GitHub:ClientId"] ?? "";
        options.ClientSecret = builder.Configuration["Authentication:GitHub:ClientSecret"] ?? "";
        options.Scope.Add("user:email");
    })

    // Apple
    .AddApple(options =>
    {
        options.ClientId = builder.Configuration["Authentication:Apple:ClientId"] ?? "";
        options.KeyId = builder.Configuration["Authentication:Apple:KeyId"] ?? "";
        options.TeamId = builder.Configuration["Authentication:Apple:TeamId"] ?? "";
        // Private key path — store the .p8 file outside the repo and reference via config
        // options.PrivateKey = ...
    });

builder.Services.AddAuthorization();

// ──────────────────────────────────────────────────────────────
// Application services
// ──────────────────────────────────────────────────────────────
builder.Services.AddHttpClient<IEmbeddingService, EmbeddingService>();
builder.Services.AddHttpClient(); // registers IHttpClientFactory for DeltaService
builder.Services.AddScoped<IDeltaService, DeltaService>();
builder.Services.AddScoped<ISnippetService, SnippetService>();

// ──────────────────────────────────────────────────────────────
// API / Swagger
// ──────────────────────────────────────────────────────────────
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new()
    {
        Title = "PromptCache API",
        Version = "v1",
        Description = "Semantic caching layer for LLM prompts with delta analysis"
    });
    c.EnableAnnotations();
});

// ──────────────────────────────────────────────────────────────
// CORS for browser extension and dashboard
// ──────────────────────────────────────────────────────────────
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins(
                builder.Configuration.GetSection("AllowedOrigins").Get<string[]>() ?? ["http://localhost:3000", "http://localhost:5173"])
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

var app = builder.Build();

// ──────────────────────────────────────────────────────────────
// Auto-apply migrations and seed default roles
// ──────────────────────────────────────────────────────────────
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await db.Database.MigrateAsync();

    var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole<Guid>>>();
    foreach (var role in new[] { "Admin", "User" })
    {
        if (!await roleManager.RoleExistsAsync(role))
            await roleManager.CreateAsync(new IdentityRole<Guid>(role));
    }
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "PromptCache API v1");
        c.RoutePrefix = string.Empty;
    });
}

app.UseCors();
app.UseHttpsRedirection();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();

