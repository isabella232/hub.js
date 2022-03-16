import { queryFeatures } from "@esri/arcgis-rest-feature-layer";
import { getItem } from "@esri/arcgis-rest-portal";
import { IHubContent } from "../core";
import {
  ItemOrServerEnrichment,
  fetchItemEnrichments,
  IItemAndEnrichments,
} from "../items/_enrichments";
import { IHubRequestOptions } from "../types";
import { isNil } from "../util";
import { addContextToSlug, isSlug, parseDatasetId } from "./slugs";
import {
  IDatasetEnrichments,
  fetchHubEnrichmentsById,
  fetchHubEnrichmentsBySlug,
  getContentEnrichments,
} from "./_fetch";
import { canUseHubApiForItem } from "./_internal";
import { composeContent, getItemLayer, isLayerView } from "./compose";

interface IFetchItemAndEnrichmentsOptions extends IHubRequestOptions {
  enrichments?: ItemOrServerEnrichment[];
}

export interface IFetchContentOptions extends IFetchItemAndEnrichmentsOptions {
  layerId?: number;
  siteOrgKey?: string;
}

const maybeFetchLayerEnrichments = async (
  itemAndEnrichments: IItemAndEnrichments,
  options?: IFetchContentOptions
) => {
  // determine if this is a client-side feature layer view
  const { item, data, layers } = itemAndEnrichments;
  const layer =
    layers && getItemLayer(item, layers, options && options.layerId);
  // TODO: add recordCount here too?
  const layerEnrichments =
    layer && isLayerView(layer) && !data
      ? await fetchItemEnrichments(item, ["data"], options)
      : undefined;
  // TODO: merge errors
  return { ...itemAndEnrichments, ...layerEnrichments };
};

const fetchItemAndEnrichments = async (
  itemId: string,
  options?: IFetchContentOptions
) => {
  // fetch the item
  const item = await getItem(itemId, options);
  // fetch the enrichments
  const enrichmentsToFetch =
    options?.enrichments || getContentEnrichments(item);
  const enrichments = await fetchItemEnrichments(
    item,
    enrichmentsToFetch,
    options
  );
  return maybeFetchLayerEnrichments({ ...enrichments, item }, options);
};

const fetchContentById = async (
  hubId: string,
  options?: IFetchContentOptions
) => {
  // start by fetching the item and item enrichments
  const { itemId } = parseDatasetId(hubId);
  const { item, ...itemEnrichments } = await fetchItemAndEnrichments(
    itemId,
    options
  );
  // did the caller request a specific layer
  const specifiedLayerId = options && options.layerId;
  // if this is a public item and we're not in enterprise
  // fetch the slug and remaining enrichments from the Hub API
  const { slug, layerId, boundary, extent, searchDescription, statistics } =
    canUseHubApiForItem(item, options)
      ? await fetchHubEnrichmentsById(hubId, options)
      : ({} as IDatasetEnrichments);
  // return a new content object composed from the item and enrichments we fetched
  return composeContent(item, {
    requestOptions: options,
    ...itemEnrichments,
    slug,
    layerId: isNil(specifiedLayerId) ? layerId : specifiedLayerId,
    boundary,
    extent,
    searchDescription,
    statistics,
  });
};

const fetchContentBySlug = async (
  fullyQualifiedSlug: string,
  options?: IFetchContentOptions
) => {
  // we only have a slug, not an item id, so we start by
  // fetching the item id (and enrichments) from the Hub API
  // NOTE: if we are in enterprise this will throw an error
  let hubEnrichments = await fetchHubEnrichmentsBySlug(
    fullyQualifiedSlug,
    options
  );
  const { itemId } = hubEnrichments;
  let { layerId } = hubEnrichments;
  // now we can fetch the item and item enrichments
  const { item, ...itemEnrichments } = await fetchItemAndEnrichments(
    itemId,
    options
  );
  // did the caller request a specific layer
  const specifiedLayerId =
    options && !isNil(options.layerId) && options.layerId;
  if (specifiedLayerId && specifiedLayerId !== layerId) {
    // we fetched Hub enrichments by slug for another dataset,
    // most likely for the parent service of this layer,
    // we need to fetch them for the specified layer instead
    layerId = specifiedLayerId;
    hubEnrichments = await fetchHubEnrichmentsById(
      `${itemId}_${layerId}`,
      options
    );
  }
  const { slug, boundary, extent, searchDescription, statistics } =
    hubEnrichments;
  // return a new content object composed from the item and enrichments we fetched
  return composeContent(item, {
    requestOptions: options,
    ...itemEnrichments,
    layerId,
    slug,
    boundary,
    extent,
    searchDescription,
    statistics,
  });
};

const fetchContentRecordCount = async (content: IHubContent) => {
  const { url, viewDefinition } = content;
  const where = viewDefinition?.definitionExpression;
  const response: any = await queryFeatures({
    url,
    where,
    returnCountOnly: true,
  });
  return response.count;
};

/**
 * Fetch enriched content from the Portal and Hub APIs.
 * @param identifier content slug or id
 * @param options Request options with additional options to control how the content or enrichments are fetched
 * @returns A content object composed of the backing item and enrichments
 *
 * ```js
 * import { fetchContent } from '@esri/hub-common'
 * // fetch content by slug
 * const content = await fetchContent('my-org::item-name')
 * ```
 */
export const fetchContent = async (
  identifier: string,
  options?: IFetchContentOptions
) => {
  const content = isSlug(identifier)
    ? await fetchContentBySlug(
        addContextToSlug(identifier, options?.siteOrgKey),
        options
      )
    : await fetchContentById(identifier, options);
  // fetch record count for layers, tables, or proxied CSVs
  const { isProxied, layer } = content;
  content.recordCount =
    isProxied || !!layer ? await fetchContentRecordCount(content) : undefined;
  return content;
};
