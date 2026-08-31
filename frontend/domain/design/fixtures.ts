import { createEmptyDesignDocument, applyDesignOperations } from "@/domain/design/applyOperations";
import type { DesignDocument } from "@/domain/design/types";
import type { DesignOperation } from "@/domain/design/operations";

export const COMMERCE_PLATFORM_FIXTURE_KEY = "commerce-platform-review-v1";
export const COMMERCE_PLATFORM_DOCUMENT_ID = "design-commerce-platform";

export const createCommercePlatformInitialDocument = () =>
  createEmptyDesignDocument(COMMERCE_PLATFORM_DOCUMENT_ID, {
    name: "Commerce Platform",
    description: "An online commerce platform used by customers.",
    assumptions: [
      "Payment authorization is delegated to the external Payment Provider.",
    ],
    decisions: [
      {
        id: "decision-commerce-eventing",
        statement: "Order-created events are published asynchronously through Order Events.",
      },
    ],
  });

/** Creates fresh operation objects so tests and callers cannot share mutable fixture state. */
export const createCommercePlatformOperations = (): DesignOperation[] => [
  {
    kind: "add-element",
    element: {
      id: "person-customer",
      kind: "person",
      name: "Customer",
      description: "Browses products and places orders.",
    },
  },
  {
    kind: "add-element",
    element: {
      id: "system-commerce-platform",
      kind: "software-system",
      name: "Commerce Platform",
      description: "Provides the online ordering experience.",
      external: false,
    },
  },
  {
    kind: "add-element",
    element: {
      id: "system-payment-provider",
      kind: "software-system",
      name: "Payment Provider",
      description: "Authorizes and captures card payments.",
      external: true,
    },
  },
  {
    kind: "add-element",
    element: {
      id: "container-web-app",
      kind: "container",
      name: "Web Application",
      description: "Browser-facing customer experience.",
      parentId: "system-commerce-platform",
      containerType: "application",
    },
  },
  {
    kind: "add-element",
    element: {
      id: "container-order-api",
      kind: "container",
      name: "Order API",
      description: "Validates orders and coordinates payment and persistence.",
      parentId: "system-commerce-platform",
      containerType: "application",
    },
  },
  {
    kind: "add-element",
    element: {
      id: "container-order-db",
      kind: "container",
      name: "Order Database",
      description: "Stores orders and payment references.",
      parentId: "system-commerce-platform",
      containerType: "datastore",
    },
  },
  {
    kind: "add-element",
    element: {
      id: "container-order-events",
      kind: "container",
      name: "Order Events",
      description: "Buffers order-created events for asynchronous consumers.",
      parentId: "system-commerce-platform",
      containerType: "queue",
    },
  },
  {
    kind: "add-relationship",
    relationship: {
      id: "relationship-customer-commerce",
      sourceId: "person-customer",
      destinationId: "system-commerce-platform",
      description: "Browses products and places orders",
      technology: "HTTPS",
    },
  },
  {
    kind: "add-relationship",
    relationship: {
      id: "relationship-commerce-payment",
      sourceId: "system-commerce-platform",
      destinationId: "system-payment-provider",
      description: "Processes customer payments",
      technology: "HTTPS/JSON",
    },
  },
  {
    kind: "add-relationship",
    relationship: {
      id: "relationship-customer-web",
      sourceId: "person-customer",
      destinationId: "container-web-app",
      description: "Uses the ordering interface",
      technology: "HTTPS",
    },
  },
  {
    kind: "add-relationship",
    relationship: {
      id: "relationship-web-api",
      sourceId: "container-web-app",
      destinationId: "container-order-api",
      description: "Submits and reads orders",
      technology: "HTTPS/JSON",
    },
  },
  {
    kind: "add-relationship",
    relationship: {
      id: "relationship-api-db",
      sourceId: "container-order-api",
      destinationId: "container-order-db",
      description: "Reads and writes order data",
      technology: "PostgreSQL protocol",
    },
  },
  {
    kind: "add-relationship",
    relationship: {
      id: "relationship-api-payment",
      sourceId: "container-order-api",
      destinationId: "system-payment-provider",
      description: "Authorizes and captures payment",
      technology: "HTTPS/JSON",
    },
  },
  {
    kind: "add-relationship",
    relationship: {
      id: "relationship-api-events",
      sourceId: "container-order-api",
      destinationId: "container-order-events",
      description: "Publishes order-created events",
      technology: "AMQP",
    },
  },
  {
    kind: "add-boundary",
    boundary: {
      id: "boundary-commerce-platform",
      name: "Commerce Platform",
      description: "Owned Commerce Platform containers.",
      ownerSystemId: "system-commerce-platform",
      elementIds: [
        "container-web-app",
        "container-order-api",
        "container-order-db",
        "container-order-events",
      ],
    },
  },
  {
    kind: "add-view",
    view: {
      id: "view-commerce-context",
      kind: "system-context",
      name: "Commerce Platform system context",
      systemId: "system-commerce-platform",
      elementIds: [
        "person-customer",
        "system-commerce-platform",
        "system-payment-provider",
      ],
      relationshipIds: [
        "relationship-customer-commerce",
        "relationship-commerce-payment",
      ],
      boundaryIds: [],
      layout: {
        elements: {
          "person-customer": { x: 80, y: 220, width: 180, height: 120 },
          "system-commerce-platform": { x: 380, y: 200, width: 240, height: 160 },
          "system-payment-provider": { x: 760, y: 220, width: 220, height: 120 },
        },
        boundaries: {},
      },
    },
  },
  {
    kind: "add-view",
    view: {
      id: "view-commerce-containers",
      kind: "container",
      name: "Commerce Platform containers",
      systemId: "system-commerce-platform",
      elementIds: [
        "person-customer",
        "container-web-app",
        "container-order-api",
        "container-order-db",
        "container-order-events",
        "system-payment-provider",
      ],
      relationshipIds: [
        "relationship-customer-web",
        "relationship-web-api",
        "relationship-api-db",
        "relationship-api-payment",
        "relationship-api-events",
      ],
      boundaryIds: ["boundary-commerce-platform"],
      layout: {
        elements: {
          "person-customer": { x: 40, y: 260, width: 180, height: 120 },
          "container-web-app": { x: 310, y: 240, width: 210, height: 140 },
          "container-order-api": { x: 610, y: 240, width: 210, height: 140 },
          "container-order-db": { x: 910, y: 100, width: 210, height: 140 },
          "container-order-events": { x: 910, y: 390, width: 210, height: 140 },
          "system-payment-provider": { x: 1240, y: 240, width: 220, height: 120 },
        },
        boundaries: {
          "boundary-commerce-platform": {
            x: 270,
            y: 50,
            width: 900,
            height: 540,
          },
        },
      },
    },
  },
  {
    kind: "add-annotation",
    annotation: {
      id: "annotation-review-payment-timeout",
      kind: "text",
      viewId: "view-commerce-containers",
      text: "Review payment timeout and retry behavior",
      position: { x: 1180, y: 430 },
    },
  },
];

export const createCommercePlatformFixture = (): DesignDocument => {
  const result = applyDesignOperations(
    createCommercePlatformInitialDocument(),
    createCommercePlatformOperations(),
  );
  if (result.ok) return result.document;
  throw new Error(
    `The ${COMMERCE_PLATFORM_FIXTURE_KEY} fixture is invalid: ${result.errors
      .map((error) => error.message)
      .join(" ")}`,
  );
};
