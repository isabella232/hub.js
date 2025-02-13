import { Logger, atob as decode } from "@esri/hub-common";
import { IPagingParams, ISearchOptions } from "@esri/arcgis-rest-portal";
import { UserSession } from "@esri/arcgis-rest-auth";
import {
  IBooleanOperator,
  IContentSearchFilter,
  IContentSearchOptions,
  IContentSearchRequest,
  IContentFieldFilter,
} from "../../types/content";
import { IDateRange } from "../../types/common";
import {
  isFilterAnArrayWithData,
  isFilterANonEmptyString,
  isFilterFieldADateRange,
} from "./common";

const TERM_FIELD = "terms";
const DEFAULT_FILTERS = ['(-type: "code attachment")'];
const STRING_ENCLOSED_FILTER_FIELDS = [
  "title",
  "type",
  "typekeywords",
  "description",
  "tags",
  "snippet",
  "categories",
];

/**
 * Converts the common request format of contentSearch to a format specific to the Portal API
 * @param request - the IContentSearchRequest instance for searching
 */
export function convertToPortalParams(
  request: IContentSearchRequest,
  defaultPortal?: string,
  defaultAuthentication?: UserSession
): ISearchOptions {
  const q: string = processFilter(request);
  const paging: IPagingParams = processPage(request) || { start: 1, num: 10 };
  return createSearchOptions(
    q,
    paging,
    request.options,
    defaultPortal,
    defaultAuthentication
  );
}

function processFilter(request: IContentSearchRequest): string {
  const filter: IContentSearchFilter = request.filter || {};
  const filters: string[] = Object.keys(filter).reduce(
    (arr: string[], key: string) => {
      const clause = convertToPortalFilterClause(key, filter[key]);
      if (clause) {
        arr.push(clause);
      }
      return arr;
    },
    []
  );
  const filtersWithDefaults = addDefaultFilters(filters);
  return filtersWithDefaults.join(" AND ").trim();
}

/**
 * Processes the paging parameters provided as part of a search request
 * @param request content search request
 */
export function processPage(request: IContentSearchRequest): IPagingParams {
  const options: IContentSearchOptions = request.options || {};
  const providedPage: IPagingParams | string = options.page || {
    start: 1,
    num: 10,
  };
  return typeof providedPage === "string"
    ? decodePage(providedPage)
    : providedPage;
}

function createSearchOptions(
  q: string,
  page: IPagingParams,
  options: IContentSearchOptions = {},
  defaultPortal?: string,
  defaultAuthentication?: UserSession
): ISearchOptions {
  return {
    q,
    sortOrder: options.sortOrder,
    sortField: options.sortField,
    params: {
      countFields: options.aggregations,
      countSize: options.aggregations ? 200 : undefined,
      start: page.start,
      num: page.num,
    },
    bbox: options.bbox,
    portal: options.portal || defaultPortal,
    authentication: options.authentication || defaultAuthentication,
    httpMethod: "POST",
  };
}

function convertToPortalFilterClause(
  filterField: string,
  filterValue: any
): string {
  if (isFilterANonEmptyString(filterValue)) {
    return processStringFilter(filterField, filterValue as string);
  } else if (isFilterAnArrayWithData(filterValue)) {
    return processArrayFilter(filterField, filterValue as string[]);
  } else if (isFilterFieldADateRange(filterField, filterValue)) {
    return processDateField(filterField, filterValue as IDateRange<number>);
  } else {
    return processFieldFilter(filterField, filterValue as IContentFieldFilter);
  }
}

function addDefaultFilters(filters: string[]) {
  return filters.concat(DEFAULT_FILTERS);
}

function processStringFilter(filterField: string, filterValue: string): string {
  if (filterField === TERM_FIELD) {
    return `(${stringifyFilterValue(filterField, filterValue)})`;
  }
  return `(${filterField}: ${stringifyFilterValue(filterField, filterValue)})`;
}

function processArrayFilter(
  filterField: string,
  filterArray: string[]
): string {
  const filters = filterArray.map((filter: string) =>
    stringifyFilterValue(filterField, filter)
  );
  return `(${filterField}: ${filters.join(` OR ${filterField}: `)})`;
}

function processDateField(
  filterField: string,
  filterValue: IDateRange<number>
) {
  return `(${filterField}: [${filterValue.from || 0} TO ${
    filterValue.to || new Date().getTime()
  }])`;
}

function processFieldFilter(
  filterField: string,
  contentFilter: IContentFieldFilter
): string {
  if (!contentFilter || !isFilterAnArrayWithData(contentFilter.value)) {
    return undefined;
  }

  const operator: IBooleanOperator = contentFilter.bool || IBooleanOperator.OR;
  const filters = contentFilter.value.map((filter: string) =>
    stringifyFilterValue(filterField, filter)
  );

  if (operator === IBooleanOperator.NOT) {
    return `(-${filterField}: ${filters.join(` AND -${filterField}: `)})`;
  } else {
    return `(${filterField}: ${filters.join(
      ` ${operator.toString()} ${filterField}: `
    )})`;
  }
}

function stringifyFilterValue(
  filterField: string,
  filterValue: string
): string {
  return STRING_ENCLOSED_FILTER_FIELDS.indexOf(filterField) >= 0
    ? `"${filterValue}"`
    : filterValue;
}

function decodePage(page: string): IPagingParams {
  try {
    const decodedPage: any = decode(page);
    if (decodedPage === null) {
      throw new Error();
    }
    return JSON.parse(decodedPage);
  } catch (err) {
    Logger.error(
      `error decoding and parsing the provided page: ${page}. Defaulting to starting page`
    );
    return undefined;
  }
}
