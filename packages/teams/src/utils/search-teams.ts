import {
  searchGroups,
  ISearchOptions,
  ISearchResult,
  IGroup,
} from "@esri/arcgis-rest-portal";

/**
 * Search for teams
 * @param {ISearchOptions} searchRequestOptions
 * @returns {Promise<ISearchResult>}
 */
export function searchTeams(
  searchRequestOptions: ISearchOptions
): Promise<ISearchResult<IGroup>> {
  return searchGroups(searchRequestOptions);
}
