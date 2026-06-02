FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY src/LLMCache.Api/ ./src/LLMCache.Api/
COPY dashboard/ ./dashboard/
COPY shared/ ./shared/
WORKDIR /src/src/LLMCache.Api
RUN dotnet restore
RUN dotnet publish -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .
EXPOSE 3001
ENV ASPNETCORE_URLS=http://+:3001
ENTRYPOINT ["dotnet", "LLMCache.Api.dll"]
