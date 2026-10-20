using System.Net.Http.Json;
using System.Text.Json;

namespace PrintCost.Api.Tests;

public sealed class FilamentPickerApiTests
{
    [Fact]
    public async Task Optional_brand_is_saved_while_older_edits_preserve_it_and_costs_stay_exact()
    {
        await using var app = new OrderApiTests.OrderFactory(); using var client = await app.LoginAsync();
        var response = await client.PostAsJsonAsync("/api/filaments/simple", new { material = "PLA", displayName = "Blanco", manufacturer = " Creality ", landedCostGs = 132000.01m, netWeightGrams = 1000 });
        response.EnsureSuccessStatusCode(); var created = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Creality", created.GetProperty("manufacturer").GetString());
        var id = created.GetProperty("id").GetGuid();
        var detailed = System.Text.Json.Nodes.JsonNode.Parse(created.GetRawText())!;
        detailed["productName"] = "Hyper PLA";
        (await client.PutAsJsonAsync($"/api/filaments/{id}", detailed)).EnsureSuccessStatusCode();
        (await client.PutAsJsonAsync($"/api/filaments/{id}/simple", new { material = "PLA", displayName = "Blanco mate", landedCostGs = 132000.01m, netWeightGrams = 1000 })).EnsureSuccessStatusCode();
        var unchanged = await client.GetFromJsonAsync<JsonElement>($"/api/filaments/{id}");
        Assert.Equal("Creality", unchanged.GetProperty("manufacturer").GetString());
        Assert.Equal("Hyper PLA", unchanged.GetProperty("productName").GetString());
        Assert.Equal(132000.01m, unchanged.GetProperty("landedCostGs").GetDecimal());
        (await client.PutAsJsonAsync($"/api/filaments/{id}/simple", new { material = "PLA", displayName = "Blanco mate", manufacturer = "Bambu Lab", landedCostGs = 132000.01m, netWeightGrams = 1000 })).EnsureSuccessStatusCode();
        Assert.Equal("Bambu Lab", (await client.GetFromJsonAsync<JsonElement>($"/api/filaments/{id}")).GetProperty("manufacturer").GetString());
        var legacy = await client.PostAsJsonAsync("/api/filaments/simple", new { material = "PLA", displayName = "Negro", landedCostGs = 100000, netWeightGrams = 1000 });
        legacy.EnsureSuccessStatusCode();
        Assert.Equal("Sin fabricante", (await legacy.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("manufacturer").GetString());
    }
}
