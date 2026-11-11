using Nims.Api.Models;

namespace Nims.Api.Data;

/// <summary>
/// Application-facing persistence boundary. The current JSON implementation executes
/// each callback against a consistent database snapshot; a future relational adapter
/// can implement the same unit-of-work contract without changing API services/controllers.
/// </summary>
public interface INimsStore
{
    Task InitializeAsync(CancellationToken cancellationToken = default);
    Task<T> ReadAsync<T>(Func<NimsDatabase, T> reader, CancellationToken cancellationToken = default);
    Task<T> UpdateAsync<T>(Func<NimsDatabase, T> update, CancellationToken cancellationToken = default);
}
