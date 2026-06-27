-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MT5Account" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "login" INTEGER NOT NULL,
    "password" TEXT NOT NULL,
    "server" TEXT NOT NULL,
    "broker_name" TEXT,
    "investor_mode" BOOLEAN NOT NULL DEFAULT true,
    "last_sync_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MT5Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trade" (
    "id" BIGSERIAL NOT NULL,
    "account_id" UUID NOT NULL,
    "ticket" BIGINT NOT NULL,
    "symbol" TEXT NOT NULL,
    "profit" DECIMAL(20,8),
    "volume" DECIMAL(20,8),
    "price" DECIMAL(20,8),
    "time" TIMESTAMPTZ(6) NOT NULL,
    "type" INTEGER,

    CONSTRAINT "Trade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountSummary" (
    "account_id" UUID NOT NULL,
    "total_profit" DECIMAL(20,8) DEFAULT 0,
    "total_trades" INTEGER DEFAULT 0,
    "winning_trades" INTEGER DEFAULT 0,
    "losing_trades" INTEGER DEFAULT 0,
    "win_rate" DECIMAL(5,2) DEFAULT 0,
    "daily_pnl" JSONB DEFAULT '{}',
    "monthly_pnl" JSONB DEFAULT '{}',
    "last_updated" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountSummary_pkey" PRIMARY KEY ("account_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "MT5Account_user_id_login_server_key" ON "MT5Account"("user_id", "login", "server");

-- CreateIndex
CREATE UNIQUE INDEX "Trade_account_id_ticket_key" ON "Trade"("account_id", "ticket");

-- AddForeignKey
ALTER TABLE "MT5Account" ADD CONSTRAINT "MT5Account_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "MT5Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountSummary" ADD CONSTRAINT "AccountSummary_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "MT5Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
