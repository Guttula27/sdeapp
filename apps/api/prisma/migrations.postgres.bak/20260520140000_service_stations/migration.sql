-- Service stations: floor counterpart of KitchenStation. A station pins a
-- group of service staff to a TableType + a subset of its tables; orders
-- placed at those tables become visible to the station's workers.

CREATE TABLE "service_stations" (
    "id"          TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "isActive"    BOOLEAN NOT NULL DEFAULT true,
    "outletId"    TEXT NOT NULL,
    "tableTypeId" TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_stations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "service_stations_outletId_idx" ON "service_stations"("outletId");

ALTER TABLE "service_stations"
  ADD CONSTRAINT "service_stations_outletId_fkey"
  FOREIGN KEY ("outletId") REFERENCES "outlets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "service_stations"
  ADD CONSTRAINT "service_stations_tableTypeId_fkey"
  FOREIGN KEY ("tableTypeId") REFERENCES "table_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "service_station_workers" (
    "id"        TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_station_workers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "service_station_workers_stationId_userId_key"
  ON "service_station_workers"("stationId", "userId");

ALTER TABLE "service_station_workers"
  ADD CONSTRAINT "service_station_workers_stationId_fkey"
  FOREIGN KEY ("stationId") REFERENCES "service_stations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "service_station_workers"
  ADD CONSTRAINT "service_station_workers_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "service_station_tables" (
    "id"        TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "tableId"   TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_station_tables_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "service_station_tables_stationId_tableId_key"
  ON "service_station_tables"("stationId", "tableId");

ALTER TABLE "service_station_tables"
  ADD CONSTRAINT "service_station_tables_stationId_fkey"
  FOREIGN KEY ("stationId") REFERENCES "service_stations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "service_station_tables"
  ADD CONSTRAINT "service_station_tables_tableId_fkey"
  FOREIGN KEY ("tableId") REFERENCES "tables"("id") ON DELETE CASCADE ON UPDATE CASCADE;
