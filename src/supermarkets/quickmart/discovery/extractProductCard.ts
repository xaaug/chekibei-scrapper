import { ElementHandle, Page } from "playwright";
import { DiscoveredProduct } from "../../../types/discovery";
import { QUICKMART_SELECTORS } from "../selectors";
import { QUICKMART_CONFIG } from "../config";
import { scopedLogger } from "../../../core/logger/logger";

const log = scopedLogger("quickmart:extractProductCard");

/**
 * Extracts discovery data from a single `.products.productInfoJs` element.
 * Returns null if critical fields (name, url) cannot be extracted.
 */
export async function extractProductCard(
  cardHandle: ElementHandle,
  category: string,
): Promise<DiscoveredProduct | null> {
  try {
    const data = await cardHandle.evaluate(
      (card, { titleSel, idSel, baseUrl }) => {
        const el = card as Element;
        const titleEl = el.querySelector(titleSel) as HTMLAnchorElement | null;
        const idInput = el.querySelector(idSel) as HTMLInputElement | null;

        const name = titleEl?.innerText?.trim() ?? "";
        const href = titleEl?.getAttribute("href") ?? "";
        const productId = idInput?.value?.trim() ?? undefined;

        return { name, href, productId };
      },
      {
        titleSel: QUICKMART_SELECTORS.productTitle,
        idSel: QUICKMART_SELECTORS.productIdInput,
        baseUrl: QUICKMART_CONFIG.baseUrl,
      },
    );

    if (!data.name || !data.href) {
      log.debug("Skipping card — missing name or href", data);
      return null;
    }

    // Resolve relative URLs
    const url = data.href.startsWith("http")
      ? data.href
      : `${QUICKMART_CONFIG.baseUrl}${data.href.startsWith("/") ? "" : "/"}${data.href}`;

    return {
      productId: data.productId || undefined,
      name: data.name,
      url,
      category,
      source: QUICKMART_CONFIG.source,
    };
  } catch (err) {
    log.warn("Failed to extract product card", {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
