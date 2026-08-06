# syntax=docker/dockerfile:1

FROM node:24-alpine AS web-build
WORKDIR /src/web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
ENV VITE_AUTH_MODE=pin-login
RUN npm run build

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS api-build
WORKDIR /src
COPY Directory.Build.props NuGet.Config ./
COPY src/PrintCost.Domain/PrintCost.Domain.csproj src/PrintCost.Domain/
COPY src/PrintCost.Application/PrintCost.Application.csproj src/PrintCost.Application/
COPY src/PrintCost.Infrastructure/PrintCost.Infrastructure.csproj src/PrintCost.Infrastructure/
COPY src/PrintCost.Api/PrintCost.Api.csproj src/PrintCost.Api/
RUN dotnet restore src/PrintCost.Api/PrintCost.Api.csproj --configfile NuGet.Config
COPY src/ src/
RUN dotnet publish src/PrintCost.Api/PrintCost.Api.csproj --configuration Release --output /app/publish --no-restore
COPY --from=web-build /src/web/dist /app/publish/wwwroot

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
ENV ASPNETCORE_URLS=http://+:8080 \
    ASPNETCORE_ENVIRONMENT=Production \
    TZ=America/Asuncion \
    Auth__Mode=PinLogin \
    Auth__CookieSecure=true \
    Auth__DataProtectionKeysPath=/var/lib/printcost/keys \
    ConnectionStrings__PrintCost="Data Source=/var/lib/printcost/data/printcost.db"
RUN mkdir -p /var/lib/printcost/data /var/lib/printcost/keys && chown -R 10001:10001 /var/lib/printcost /app
COPY --from=api-build --chown=10001:10001 /app/publish ./
USER 10001:10001
EXPOSE 8080
ENTRYPOINT ["dotnet", "PrintCost.Api.dll"]

