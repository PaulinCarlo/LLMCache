namespace LLMCache.Api.Configuration;
public static class ConfigExtension
{
    public static IServiceCollection AddConfigurationSection<T>(
        this IServiceCollection services,
        IConfiguration configuration,
        string sectionName)
        where T : class
    {
        var section = configuration.GetSection(sectionName);
        var settings = section.Get<T>()
            ?? throw new InvalidOperationException(
                $"Configuration section '{sectionName}' is missing or could not be bound to {typeof(T).Name}.");

        services.AddSingleton(settings);
        services.Configure<T>(section);

        return services;
    }
}   