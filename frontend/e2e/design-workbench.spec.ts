import { expect, test } from "@playwright/test";

test("edits the shared fixture across semantic views", async ({ page }) => {
  await page.goto("/designs/workbench");
  await expect(page.getByRole("heading", { name: "Design atelier" })).toBeVisible();
  await expect(page.getByTestId("element-person-customer")).toBeVisible();

  await page
    .getByRole("button", { name: /Commerce Platform containers/i })
    .click();
  await expect(page.getByTestId("element-container-order-api")).toBeVisible();
  await page.getByTestId("element-container-order-api").click();
  const nameField = page.getByRole("textbox", { name: "Name", exact: true });
  await expect(nameField).toHaveValue("Order API");

  await page.getByRole("button", { name: "Datastore", exact: true }).click();
  await expect(nameField).toHaveValue("New datastore");
  await nameField.fill("Product search index");
  await nameField.blur();
  await expect(page.getByText("Product search index", { exact: true })).toBeVisible();
});

test("keeps an imported legacy Board in IndexedDB after reload", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open("open-workboard");
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains("boards")) {
            request.result.createObjectStore("boards", { keyPath: "id" });
          }
        };
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const transaction = request.result.transaction("boards", "readwrite");
          transaction.objectStore("boards").put({
            id: "open-workboard-board",
            version: 1,
            updatedAt: Date.now(),
            state: {
              tool: "select",
              color: "#000000",
              lineWidth: 4,
              strokes: [
                {
                  id: "browser-stroke",
                  tool: "pencil",
                  color: "#e14b2a",
                  lineWidth: 4,
                  points: [
                    { x: 320, y: 180 },
                    { x: 360, y: 220 },
                    { x: 410, y: 190 },
                  ],
                  bounds: { minX: 320, minY: 180, maxX: 410, maxY: 220 },
                },
              ],
            },
          });
          transaction.oncomplete = () => {
            request.result.close();
            resolve();
          };
          transaction.onerror = () => reject(transaction.error);
        };
      }),
  );

  await page.goto("/designs/workbench");
  await page.getByRole("button", { name: /Import retained v1 Board/i }).click();
  await expect(page.getByText(/original IndexedDB record was retained/i)).toBeVisible();
  await expect(page.getByTestId(/annotation-annotation-legacy/)).toBeVisible();

  await page.reload();
  await expect(page.getByTestId(/annotation-annotation-legacy/)).toBeVisible();
  const retained = await page.evaluate(
    () =>
      new Promise<boolean>((resolve, reject) => {
        const request = indexedDB.open("open-workboard");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const lookup = request.result
            .transaction("boards", "readonly")
            .objectStore("boards")
            .get("open-workboard-board");
          lookup.onsuccess = () => {
            request.result.close();
            resolve(Boolean(lookup.result));
          };
          lookup.onerror = () => reject(lookup.error);
        };
      }),
  );
  expect(retained).toBe(true);
});
