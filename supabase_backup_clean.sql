--
-- PostgreSQL database dump
--

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: BonusType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."BonusType" AS ENUM (
    'welcome',
    'deposit',
    'referral',
    'vip',
    'seasonal',
    'wheel'
);


--
-- Name: DepositStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."DepositStatus" AS ENUM (
    'pending',
    'processing',
    'approved',
    'failed'
);


--
-- Name: NotificationType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."NotificationType" AS ENUM (
    'info',
    'success',
    'warning',
    'error'
);


--
-- Name: PaymentMethodType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PaymentMethodType" AS ENUM (
    'crypto',
    'card',
    'wallet',
    'bank'
);


--
-- Name: Role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."Role" AS ENUM (
    'user',
    'admin'
);


--
-- Name: TicketPriority; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."TicketPriority" AS ENUM (
    'low',
    'medium',
    'high',
    'urgent'
);


--
-- Name: TicketStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."TicketStatus" AS ENUM (
    'open',
    'in_progress',
    'resolved',
    'closed'
);


--
-- Name: WithdrawalStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."WithdrawalStatus" AS ENUM (
    'pending',
    'approved',
    'rejected',
    'paid'
);


--
-- Name: rls_auto_enable(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rls_auto_enable() RETURNS event_trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: ActivityLog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ActivityLog" (
    id text NOT NULL,
    "userId" text NOT NULL,
    action text NOT NULL,
    entity text,
    "entityId" text,
    ip text,
    "userAgent" text,
    metadata jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: AdminWallet; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AdminWallet" (
    id text NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    address text NOT NULL,
    currency text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "totalIn" double precision DEFAULT 0 NOT NULL,
    "totalOut" double precision DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Announcement; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Announcement" (
    id text NOT NULL,
    title text NOT NULL,
    content text NOT NULL,
    type text DEFAULT 'info'::text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "expiresAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Banner; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Banner" (
    id text NOT NULL,
    title text NOT NULL,
    subtitle text,
    "imageUrl" text NOT NULL,
    "videoUrl" text,
    "ctaText" text,
    "ctaLink" text,
    "order" integer DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "startsAt" timestamp(3) without time zone,
    "endsAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Bonus; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Bonus" (
    id text NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    type public."BonusType" NOT NULL,
    amount double precision,
    percentage double precision,
    "minDeposit" double precision,
    "maxBonus" double precision,
    requirements text NOT NULL,
    terms text NOT NULL,
    "expiresAt" timestamp(3) without time zone,
    "isActive" boolean DEFAULT true NOT NULL,
    "bannerUrl" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: BonusClaim; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."BonusClaim" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "bonusId" text NOT NULL,
    amount double precision NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Conversation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Conversation" (
    id text NOT NULL,
    conversation_id text NOT NULL,
    user_id text,
    telegram_user_id text,
    telegram_username text,
    telegram_thread_id text,
    source text NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: Deposit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Deposit" (
    id text NOT NULL,
    "userId" text NOT NULL,
    amount double precision NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    "paymentMethodId" text,
    status public."DepositStatus" DEFAULT 'pending'::public."DepositStatus" NOT NULL,
    "transactionId" text,
    "paymentReference" text,
    "proofImage" text,
    notes text,
    "webhookData" jsonb,
    "approvedBy" text,
    "approvedAt" timestamp(3) without time zone,
    "rejectedBy" text,
    "rejectedAt" timestamp(3) without time zone,
    "rejectionReason" text,
    "telegramMessageId" text,
    "telegramChatId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: DepositTransaction; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."DepositTransaction" (
    id text NOT NULL,
    "depositId" text NOT NULL,
    "providerId" text,
    "transactionRef" text NOT NULL,
    status text NOT NULL,
    amount double precision NOT NULL,
    currency text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: FAQ; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."FAQ" (
    id text NOT NULL,
    question text NOT NULL,
    answer text NOT NULL,
    category text DEFAULT 'general'::text NOT NULL,
    "order" integer DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Game; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Game" (
    id text NOT NULL,
    name text NOT NULL,
    description text NOT NULL,
    category text NOT NULL,
    version text NOT NULL,
    "downloadUrl" text,
    "downloadCount" integer DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "isFeatured" boolean DEFAULT false NOT NULL,
    "thumbnailUrl" text,
    screenshots text[] DEFAULT ARRAY[]::text[],
    requirements text,
    instructions text,
    rating double precision DEFAULT 0 NOT NULL,
    "providerId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: GameDownload; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."GameDownload" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "gameId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Message; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Message" (
    id text NOT NULL,
    conversation_id text NOT NULL,
    sender_type text NOT NULL,
    message text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Notification; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Notification" (
    id text NOT NULL,
    "userId" text NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    type public."NotificationType" DEFAULT 'info'::public."NotificationType" NOT NULL,
    "isRead" boolean DEFAULT false NOT NULL,
    link text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: PaymentMethod; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PaymentMethod" (
    id text NOT NULL,
    name text NOT NULL,
    code text NOT NULL,
    type public."PaymentMethodType" NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "minAmount" double precision DEFAULT 10 NOT NULL,
    "maxAmount" double precision DEFAULT 100000 NOT NULL,
    "feePercent" double precision DEFAULT 0 NOT NULL,
    "iconUrl" text,
    instructions text,
    fields jsonb DEFAULT '[]'::jsonb NOT NULL,
    "apiConfig" jsonb,
    "cashoutEnabled" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: PaymentWebhook; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PaymentWebhook" (
    id text NOT NULL,
    provider text NOT NULL,
    payload jsonb NOT NULL,
    status text NOT NULL,
    error text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Provider; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Provider" (
    id text NOT NULL,
    name text NOT NULL,
    "apiBaseUrl" text NOT NULL,
    "agentId" text NOT NULL,
    "secretKey" text NOT NULL,
    status boolean DEFAULT true NOT NULL,
    logo text,
    "requestTimeout" integer DEFAULT 5000 NOT NULL,
    "retryCount" integer DEFAULT 3 NOT NULL,
    endpoints jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: ProviderBalanceHistory; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ProviderBalanceHistory" (
    id text NOT NULL,
    "providerId" text NOT NULL,
    balance double precision NOT NULL,
    "recordedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: ProviderLog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ProviderLog" (
    id text NOT NULL,
    "providerId" text,
    "userId" text,
    endpoint text NOT NULL,
    request jsonb,
    response jsonb,
    status integer NOT NULL,
    "errorMessage" text,
    "ipAddress" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: ProviderTransaction; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ProviderTransaction" (
    id text NOT NULL,
    "providerId" text NOT NULL,
    "userId" text NOT NULL,
    type text NOT NULL,
    amount double precision NOT NULL,
    "orderId" text NOT NULL,
    "providerOrderId" text,
    status text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: ProviderUser; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ProviderUser" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "providerId" text NOT NULL,
    "providerUserId" text NOT NULL,
    "accountName" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Setting; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Setting" (
    id text NOT NULL,
    key text NOT NULL,
    value text NOT NULL,
    type text DEFAULT 'string'::text NOT NULL,
    "group" text DEFAULT 'general'::text NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: SupportTicket; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SupportTicket" (
    id text NOT NULL,
    "userId" text NOT NULL,
    subject text NOT NULL,
    message text NOT NULL,
    status public."TicketStatus" DEFAULT 'open'::public."TicketStatus" NOT NULL,
    priority public."TicketPriority" DEFAULT 'medium'::public."TicketPriority" NOT NULL,
    category text NOT NULL,
    "assignedTo" text,
    "closedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: TicketReply; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."TicketReply" (
    id text NOT NULL,
    "ticketId" text NOT NULL,
    "userId" text NOT NULL,
    message text NOT NULL,
    "isAdmin" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: TransactionLog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."TransactionLog" (
    id text NOT NULL,
    type text NOT NULL,
    "entityId" text NOT NULL,
    "userId" text,
    amount double precision,
    status text NOT NULL,
    metadata jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: User; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."User" (
    id text NOT NULL,
    username text NOT NULL,
    email text NOT NULL,
    password text NOT NULL,
    role public."Role" DEFAULT 'user'::public."Role" NOT NULL,
    "isVerified" boolean DEFAULT false NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "isBanned" boolean DEFAULT false NOT NULL,
    "verifyToken" text,
    "resetToken" text,
    "resetExpiry" timestamp(3) without time zone,
    "lastLogin" timestamp(3) without time zone,
    "referralCode" text,
    "promoCode" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "referredById" text
);


--
-- Name: UserProfile; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."UserProfile" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "fullName" text,
    phone text,
    country text,
    avatar text,
    "telegramUsername" text,
    "telegramId" text,
    "telegramPhone" text
);


--
-- Name: Withdrawal; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Withdrawal" (
    id text NOT NULL,
    "userId" text NOT NULL,
    amount double precision NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    "paymentMethodId" text,
    "accountInfo" text NOT NULL,
    status public."WithdrawalStatus" DEFAULT 'pending'::public."WithdrawalStatus" NOT NULL,
    "adminNotes" text,
    "processedBy" text,
    "processedAt" timestamp(3) without time zone,
    "requestId" text,
    "paymentMethodStr" text,
    "accountDetails" text,
    "approvedBy" text,
    "approvedAt" timestamp(3) without time zone,
    "rejectedBy" text,
    "rejectedAt" timestamp(3) without time zone,
    "rejectionReason" text,
    locked boolean DEFAULT false NOT NULL,
    "telegramMessageId" text,
    "telegramChatId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Data for Name: ActivityLog; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ActivityLog" (id, "userId", action, entity, "entityId", ip, "userAgent", metadata, "createdAt") FROM stdin;
cmr69kr5u0001sge18pgfrfsy	cmr69jqsu000012lh99aj857o	login	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	\N	2026-07-04 05:43:35.106
cmr69lsor0001ico7mjp4i63m	cmr69jqsu000012lh99aj857o	login	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	\N	2026-07-04 05:44:23.235
cmr6a8s5q001exv9xatoso9hf	cmr69jqsu000012lh99aj857o	login	\N	\N	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	\N	2026-07-04 06:02:16.142
cmr6b5k8h0008mn9sy3u2h4zo	cmr6b50aw0003mn9sssynf9dg	login	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	\N	2026-07-04 06:27:45.439
cmr6bd152000amn9swnhfpv6n	cmr6b50aw0003mn9sssynf9dg	login	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	\N	2026-07-04 06:33:34.023
cmr7a2kf2000cmn9sm04o0ktj	cmr6b50aw0003mn9sssynf9dg	login	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	\N	2026-07-04 22:45:12.348
cmr7a3azz000emn9ssezy50wb	cmr6b50aw0003mn9sssynf9dg	login	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	\N	2026-07-04 22:45:46.799
cmr7a8sbk0001118gkco6064c	cmr6b50aw0003mn9sssynf9dg	login	\N	\N	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	\N	2026-07-04 22:50:02.526
cmr7afp0a0001d41d9vgg0cnh	cmr69jqsu000012lh99aj857o	login	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	\N	2026-07-04 22:55:24.826
cmr7agkki0005d41dontw6txg	cmr6b50aw0003mn9sssynf9dg	login	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	\N	2026-07-04 22:56:05.633
cmr7ala4c00018jwrh5l47ar0	cmr69jqsu000012lh99aj857o	login	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	\N	2026-07-04 22:59:45.406
cmr7amavf00058jwrrqezuacn	cmr6b50aw0003mn9sssynf9dg	login	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	\N	2026-07-04 23:00:33.099
cmr7ao7r300098jwre6s8rrgk	cmr69jqsu000012lh99aj857o	login	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	\N	2026-07-04 23:02:02.268
cmr7av8w70001conqha5dejui	cmr6b50aw0003mn9sssynf9dg	login	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	\N	2026-07-04 23:07:29.895
cmr7ayb0z000mconqyhqr3opx	cmr69jqsu000012lh99aj857o	login	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	\N	2026-07-04 23:09:53.089
cmr7b1b9h000pconql2twyumt	cmr6b50aw0003mn9sssynf9dg	login	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	\N	2026-07-04 23:12:13.445
cmr7b4357000rconq9fsiy81f	cmr69jqsu000012lh99aj857o	login	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	\N	2026-07-04 23:14:22.891
cmr7cd82r0001ozy9vfnps1g7	cmr69jqsu000012lh99aj857o	login	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	\N	2026-07-04 23:49:28.802
cmr7cllpk000iozy95r5ghqxs	cmr7cl0hc000fozy9nbyyy76r	login	\N	\N	::ffff:127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Mobile Safari/537.36	\N	2026-07-04 23:55:59.525
cmr7dfte40009uv75fgff368f	cmr7cl0hc000fozy9nbyyy76r	login	\N	\N	::ffff:127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Mobile Safari/537.36	\N	2026-07-05 00:19:28.373
cmr7dr3kt0009wf3u1fjr6y9b	cmr7cl0hc000fozy9nbyyy76r	login	\N	\N	::ffff:127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Mobile Safari/537.36	\N	2026-07-05 00:28:15.57
cmr7i5uvo0007dp3ooxwj9a3w	cmr7cl0hc000fozy9nbyyy76r	login	\N	\N	::ffff:127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Mobile Safari/537.36	\N	2026-07-05 02:31:42.801
cmr7i93vc0009dp3oy1brel0f	cmr69jqsu000012lh99aj857o	login	\N	\N	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	\N	2026-07-05 02:34:14.213
cmr7izc0f0003upefdkcb8q9s	cmr69jqsu000012lh99aj857o	login	\N	\N	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	\N	2026-07-05 02:54:38.031
cmr7jou6a0001syif7re72tmk	cmr69jqsu000012lh99aj857o	login	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	\N	2026-07-05 03:14:27.76
cmr7jww3j0001gnzjwjgtwzx1	cmr69jqsu000012lh99aj857o	login	\N	\N	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	\N	2026-07-05 03:20:43.71
cmr7k4ifr00016xsxthnzwuzq	cmr6b50aw0003mn9sssynf9dg	login	\N	\N	::1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Mobile Safari/537.36	\N	2026-07-05 03:26:37.991
cmr7kauyq0001ejsrjcjkog38	cmr6b50aw0003mn9sssynf9dg	login	\N	\N	::ffff:127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Mobile Safari/537.36	\N	2026-07-05 03:31:35.426
cmr7l1ate001mnggfg0eoxge2	cmr6b50aw0003mn9sssynf9dg	login	\N	\N	::ffff:127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Mobile Safari/537.36	\N	2026-07-05 03:52:07.826
cmr7lnlml001wnggfwlv65tmo	cmr69jqsu000012lh99aj857o	login	\N	\N	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	\N	2026-07-05 04:09:29.469
cmr7mykur000f1bi49i7n40nn	cmr69jqsu000012lh99aj857o	login	\N	\N	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	\N	2026-07-05 04:46:01.109
cmr8urjdl0001d1fmqcqnuf1n	cmr69jqsu000012lh99aj857o	login	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	\N	2026-07-06 01:12:15.897
cmr8z0g5x001dd1fml321iuf8	cmr7cl0hc000fozy9nbyyy76r	login	\N	\N	::1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Mobile Safari/537.36	\N	2026-07-06 03:11:09.889
cmravxc5z002bd1fmgo9zg7mf	cmravwyxd001yd1fmakz8rtio	login	\N	\N	::ffff:127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Mobile Safari/537.36	\N	2026-07-07 11:20:18.257
cmraw0vq3002jd1fm53q9byld	cmravwyxd001yd1fmakz8rtio	login	\N	\N	::ffff:127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Mobile Safari/537.36	\N	2026-07-07 11:23:03.771
cmrawjda00034d1fmwh1rg30t	cmravwyxd001yd1fmakz8rtio	login	\N	\N	::1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Mobile Safari/537.36	\N	2026-07-07 11:37:26.133
cmrbt9gd4004vd1fmdgulc1uy	cmr69jqsu000012lh99aj857o	login	\N	\N	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	\N	2026-07-08 02:53:29.786
cmrcflm9500031uvamv0i89y2	cmr69jqsu000012lh99aj857o	login	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	\N	2026-07-08 13:18:50.152
cmrcfzy8h00051uvaekm32970	cmr69jqsu000012lh99aj857o	login	\N	\N	::1	Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36	\N	2026-07-08 13:29:58.865
cmrchq2li0001hloap2ge0gkw	cmr69jqsu000012lh99aj857o	login	\N	\N	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	\N	2026-07-08 14:18:16.741
cmrchy6w20001zv5i0zdukop5	cmr7cl0hc000fozy9nbyyy76r	login	\N	\N	::ffff:127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Mobile Safari/537.36	\N	2026-07-08 14:24:35.796
cmrci83p70003zv5ik82wwoh5	cmr7cl0hc000fozy9nbyyy76r	login	\N	\N	::ffff:127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Mobile Safari/537.36	\N	2026-07-08 14:32:18.427
cmrcjfj2k000bzv5iwleev4ei	cmravwyxd001yd1fmakz8rtio	login	\N	\N	::1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Mobile Safari/537.36	\N	2026-07-08 15:06:03.238
cmrcjg2lr000dzv5ipk62bgeh	cmravwyxd001yd1fmakz8rtio	login	\N	\N	::1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Mobile Safari/537.36	\N	2026-07-08 15:06:29.664
cmrckfi3h000rzv5iqnh4q95s	cmr7cl0hc000fozy9nbyyy76r	login	\N	\N	::1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Mobile Safari/537.36	\N	2026-07-08 15:34:02.908
cmrddkxud000tzv5ihirvk6sr	cmr6b50aw0003mn9sssynf9dg	login	\N	\N	::1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Mobile Safari/537.36	\N	2026-07-09 05:10:05.46
cmrdlyvzn0001fotg3uzuk248	cmr69jqsu000012lh99aj857o	login	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	\N	2026-07-09 09:04:53.168
cmre452xy0010zv5i4hob0kxf	cmravwyxd001yd1fmakz8rtio	login	\N	\N	::ffff:127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36	\N	2026-07-09 17:33:35.002
cmrgsj03u000113m5012if3gz	cmr69jqsu000012lh99aj857o	login	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	\N	2026-07-11 14:31:47.764
cmrgtvlkt000rcyz8yexibtjb	cmrgtuww2000ecyz8yx2kxdgc	login	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	\N	2026-07-11 15:09:34.963
cmrgtzzs20003s0r6edop9ylc	cmr69jqsu000012lh99aj857o	login	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	\N	2026-07-11 15:12:59.683
cmrgvd0mv000ycyz80lu7xhrf	cmrgtuww2000ecyz8yx2kxdgc	login	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	\N	2026-07-11 15:51:07.447
cmrgw01jj0001hc255bxzueyb	cmrgtuww2000ecyz8yx2kxdgc	login	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	\N	2026-07-11 16:09:01.188
cmrgyejtt0001gj34d2cjvjbz	cmrgtuww2000ecyz8yx2kxdgc	login	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	\N	2026-07-11 22:46:17.474
cmrgyescg0003gj34qrb5w60y	cmrgtuww2000ecyz8yx2kxdgc	login	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	\N	2026-07-11 22:46:28.863
cmrhlkznr0003wtnprtjxblhj	cmr69jqsu000012lh99aj857o	login	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	\N	2026-07-12 09:35:09.388
cmrhour8p000swtnp7817u1jm	cmr69jqsu000012lh99aj857o	login	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	\N	2026-07-12 11:06:43.944
cmrhpegh000018hmh1j90biyk	cmr69jqsu000012lh99aj857o	login	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	\N	2026-07-12 11:22:03.104
cmrhqnj6s000112i3rkq9x2yp	cmr69jqsu000012lh99aj857o	login	\N	\N	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	\N	2026-07-12 11:57:06.148
cmrku0zly0005ewls973qm76j	cmravwyxd001yd1fmakz8rtio	login	\N	\N	::ffff:127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36	\N	2026-07-14 15:54:51.277
cmrmcuy8a00085qf3sme4x6o9	cmravwyxd001yd1fmakz8rtio	login	\N	\N	::1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36	\N	2026-07-15 17:29:48.147
cmrny01iy0001gy1kzibzugjr	cmr69jqsu000012lh99aj857o	login	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	\N	2026-07-16 20:09:24.151
cmro3e4i80001fkfor90q0xrh	cmr69jqsu000012lh99aj857o	login	\N	\N	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36 Edg/150.0.0.0	\N	2026-07-16 22:40:19.226
cmrqy3opb0001k5nu9rchny8b	cmr69jqsu000012lh99aj857o	login	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	\N	2026-07-18 22:35:32.687
cmrqy8y3m0003k5nu4mffkp64	cmr69jqsu000012lh99aj857o	login	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	\N	2026-07-18 22:39:37.889
cmrqyhix20005k5nu0yjv3qc2	cmr69jqsu000012lh99aj857o	login	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	\N	2026-07-18 22:46:18.031
cmrqyj24n0007k5nu2wp8bpth	cmr6b50aw0003mn9sssynf9dg	login	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	\N	2026-07-18 22:47:29.641
cmrqym7fc0009k5nu3n3dhuhx	cmr6b50aw0003mn9sssynf9dg	login	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	\N	2026-07-18 22:49:56.759
cmrqyosg7000bk5nuwijsbsod	cmr69jqsu000012lh99aj857o	login	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	\N	2026-07-18 22:51:57.319
cmrqz2smu000111m6zlg9yj6x	cmr6b50aw0003mn9sssynf9dg	login	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	\N	2026-07-18 23:02:50.376
cmrqz5uar000311m6xkv280hd	cmr69jqsu000012lh99aj857o	login	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	\N	2026-07-18 23:05:12.604
cmrqzjjzg00016ihj2qbph3dj	cmr6b50aw0003mn9sssynf9dg	login	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	\N	2026-07-18 23:15:52.433
cmrqzuk2a00036ihjfm7ftyn1	cmr6b50aw0003mn9sssynf9dg	login	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	\N	2026-07-18 23:24:25.742
cmrqzycx8000g6ihjd5ao3v1v	cmr6b50aw0003mn9sssynf9dg	login	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	\N	2026-07-18 23:27:23.02
cmrqzvhfi00086ihjrvsi49rc	cmrqzvdm100056ihjug2ahews	login	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	\N	2026-07-18 23:25:09.246
cmrqzvtyq000e6ihjy7amv8jv	cmrqzvdm100056ihjug2ahews	login	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	\N	2026-07-18 23:25:25.491
cmrr0mw8w00013at0ahhkoat2	cmr6b50aw0003mn9sssynf9dg	login	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	\N	2026-07-18 23:46:27.879
cmrr0vw0l00033at081n450td	cmr6b50aw0003mn9sssynf9dg	login	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	\N	2026-07-18 23:53:27.765
cmrr1h5ci0001cdn9j29036oe	cmr6b50aw0003mn9sssynf9dg	login	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	\N	2026-07-19 00:09:57.799
cmrr1hbrx0003cdn9vjywatrj	cmr6b50aw0003mn9sssynf9dg	login	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	\N	2026-07-19 00:10:07.966
cmrr1n7p5000110fftyq94jcc	cmr6b50aw0003mn9sssynf9dg	login	\N	\N	::ffff:127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36	\N	2026-07-19 00:14:42.278
cmrr1zd780001my3ypoydj3ai	cmr6b50aw0003mn9sssynf9dg	login	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	\N	2026-07-19 00:24:07.094
cmrr253jl0001sw84fnebcca4	cmr6b50aw0003mn9sssynf9dg	login	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	\N	2026-07-19 00:28:37.041
cmrr2apg3000e12lgformeyrp	cmr6b50aw0003mn9sssynf9dg	login	\N	\N	::ffff:127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36	\N	2026-07-19 00:32:58.652
cmrr2bd0w000g12lgw9arjcsp	cmr6b50aw0003mn9sssynf9dg	login	\N	\N	::ffff:127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36	\N	2026-07-19 00:33:29.21
cmrrp6duh00019j100uenzsdc	cmr6b50aw0003mn9sssynf9dg	login	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	\N	2026-07-19 11:13:28.213
cmrrp6gz800039j103cq5k1ot	cmr6b50aw0003mn9sssynf9dg	login	\N	\N	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	\N	2026-07-19 11:13:32.276
cmrrpxyf10001rsi2winkrev6	cmr69jqsu000012lh99aj857o	login	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	\N	2026-07-19 11:34:54.322
cmrrqfmbx0001ypvwtnr4vz6t	cmr69jqsu000012lh99aj857o	login	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	\N	2026-07-19 11:48:38.728
cmrrqi5w90003ypvw9xjzcw3t	cmr6b50aw0003mn9sssynf9dg	login	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	\N	2026-07-19 11:50:37.401
cmrrqxxkw000hypvwhcwkuis3	cmr69jqsu000012lh99aj857o	login	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	\N	2026-07-19 12:02:53.12
cmrrr1rfo0001rn7it0h89hbs	cmr69jqsu000012lh99aj857o	login	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	\N	2026-07-19 12:05:51.781
cmrrsljid00011358o5pox05n	cmr6b50aw0003mn9sssynf9dg	login	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	\N	2026-07-19 12:49:14.241
cmrs1tg3r0005139vyifnh7x5	cmr6b50aw0003mn9sssynf9dg	login	\N	\N	::ffff:127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36	\N	2026-07-19 17:07:19.568
cmrtouex80001azesmw7s75bx	cmr69jqsu000012lh99aj857o	login	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	\N	2026-07-20 20:39:42.092
cmrtp1rq1000bazesy79se1mh	cmr69jqsu000012lh99aj857o	login	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	\N	2026-07-20 20:45:23.399
cmrtpb9vv0009ugt0e2tr1k6x	cmr6b50aw0003mn9sssynf9dg	login	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	\N	2026-07-20 20:52:48.451
cmrtpc3ip000dugt0dz42pccm	cmr69jqsu000012lh99aj857o	login	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	\N	2026-07-20 20:53:26.86
cmrtq6lwg000j3o3n4m7h48hg	cmr69jqsu000012lh99aj857o	login	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	\N	2026-07-20 21:17:10.364
cms2oxzqk000qjaf7pufscfqq	cmr6b50aw0003mn9sssynf9dg	login	\N	\N	::ffff:127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36	\N	2026-07-27 03:52:24.619
cms2shnng0001d2ivr4nyd9ok	cmr69jqsu000012lh99aj857o	login	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	\N	2026-07-27 05:31:40.921
cms2tzqpe0003d2ivmzqzdihl	cmr69jqsu000012lh99aj857o	login	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	\N	2026-07-27 06:13:42.214
cms2uq2vt0005d2ivzx9qgizr	cmr69jqsu000012lh99aj857o	login	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	\N	2026-07-27 06:34:13.14
cms2vrlry000ad2ivtucegtkq	cmr69jqsu000012lh99aj857o	login	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	\N	2026-07-27 07:03:23.637
cms2vvddx000sjaf71zb9uxhv	cmr6b50aw0003mn9sssynf9dg	login	\N	\N	::ffff:127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36	\N	2026-07-27 07:06:19.319
cms3go33v000i30c0psf1kmyp	cms3gns5x000530c0xul9v2ea	login	\N	\N	::ffff:127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36	\N	2026-07-27 16:48:31.619
cms3gp4u1000k30c08hfsfx56	cmr6b50aw0003mn9sssynf9dg	login	\N	\N	::1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36	\N	2026-07-27 16:49:20.512
cms3is7s60001m3grneo1qlh1	cmr69jqsu000012lh99aj857o	login	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	\N	2026-07-27 17:47:43.589
cms3iwplc001330c07gbhtwg6	cmr7cl0hc000fozy9nbyyy76r	login	\N	\N	::ffff:127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36	\N	2026-07-27 17:51:12.956
cms3ixeht001530c0m5hkvvw6	cmr7cl0hc000fozy9nbyyy76r	login	\N	\N	::1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36	\N	2026-07-27 17:51:45.568
cms53w6r60001zvv0rgkdck6f	cmr69jqsu000012lh99aj857o	login	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	\N	2026-07-28 20:26:26.991
cms7jkf9l000e1354bmdy2jbf	cms7jkbiu00051354c1gpeu4h	login	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	\N	2026-07-30 13:20:44.361
cms7jn423000i1354ds9d282x	cms3gns5x000530c0xul9v2ea	login	\N	\N	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	\N	2026-07-30 13:22:49.746
cms7v66cq000q1354om23z7n2	cmr6b50aw0003mn9sssynf9dg	login	\N	\N	::ffff:127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36	\N	2026-07-30 18:45:34.963
cmsc1np9d0001ftgzgtw6ewmb	cmr69jqsu000012lh99aj857o	login	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	\N	2026-08-02 16:58:14.727
cmsc3dzgj000179ufnokwovdv	cmr69jqsu000012lh99aj857o	login	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	\N	2026-08-02 17:46:40.944
cmsc3fbtc000379ufkvaqvars	cmr6b50aw0003mn9sssynf9dg	login	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	\N	2026-08-02 17:47:43.631
cmsdo4qsi0001kutgp4snhlsh	cmr69jqsu000012lh99aj857o	login	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	\N	2026-08-03 20:15:07.465
cmsdskjnv00014w61gqhxxjf2	cmr69jqsu000012lh99aj857o	login	\N	\N	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	\N	2026-08-03 22:19:22.792
cmsfo4o3y00017y6f90ize056	cmravwyxd001yd1fmakz8rtio	login	\N	\N	::1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36	\N	2026-08-05 05:50:36.758
cmsfpv49300037y6fh3i0ac4d	cmravwyxd001yd1fmakz8rtio	login	\N	\N	::1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36	\N	2026-08-05 06:39:10.352
cmsfpx66r00057y6fpz2hynqg	cmravwyxd001yd1fmakz8rtio	login	\N	\N	::ffff:127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36	\N	2026-08-05 06:40:46.173
cmsfvc5cu00077y6fepx9xmq4	cmr69jqsu000012lh99aj857o	login	\N	\N	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	\N	2026-08-05 09:12:23.016
cmsfwcgwv0001xhy0ibvwvmns	cmr69jqsu000012lh99aj857o	login	\N	\N	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	\N	2026-08-05 09:40:37.331
cmsfwq6290001at3aa0jsn0a9	cmr69jqsu000012lh99aj857o	login	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	\N	2026-08-05 09:51:16.43
cmsfwqfoo0003at3a7tq7sbyb	cmr69jqsu000012lh99aj857o	login	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	\N	2026-08-05 09:51:29.256
cmsfwqnee0005at3a2xnwqw2c	cmr69jqsu000012lh99aj857o	login	\N	\N	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	\N	2026-08-05 09:51:39.196
cmshbgybl000bat3a0efnh2ae	cmr69jqsu000012lh99aj857o	login	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	\N	2026-08-06 09:31:47.265
cmshbjgd2000pat3ao9o4rd8f	cmrgtuww2000ecyz8yx2kxdgc	login	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	\N	2026-08-06 09:33:43.958
cmshbwxlx0001826m0udv5zfe	cmrgtuww2000ecyz8yx2kxdgc	login	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	\N	2026-08-06 09:44:12.475
cmshc5tw00001u5zndyyz7no5	cmr69jqsu000012lh99aj857o	login	\N	\N	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	\N	2026-08-06 09:51:07.863
cmshd2ank0009yfiywiqq0lv3	cmr69jqsu000012lh99aj857o	login	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	\N	2026-08-06 10:16:22.319
cmshd4p9i0001ks5ody97m1nq	cmr69jqsu000012lh99aj857o	login	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	\N	2026-08-06 10:18:14.886
cmshe5j3d0003ks5opbtzxotz	cmr69jqsu000012lh99aj857o	login	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	\N	2026-08-06 10:46:53.161
cmsi4dikk0009u5zna3czan63	cmr6b50aw0003mn9sssynf9dg	login	\N	\N	::1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36	\N	2026-08-06 23:00:55.748
cmsicdszb00012l32c74tmreo	cms3gns5x000530c0xul9v2ea	login	\N	\N	::ffff:127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36	\N	2026-08-07 02:45:05.84
\.


--
-- Data for Name: AdminWallet; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."AdminWallet" (id, name, type, address, currency, "isActive", "totalIn", "totalOut", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: Announcement; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Announcement" (id, title, content, type, "isActive", "expiresAt", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: Banner; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Banner" (id, title, subtitle, "imageUrl", "videoUrl", "ctaText", "ctaLink", "order", "isActive", "startsAt", "endsAt", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: Bonus; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Bonus" (id, title, description, type, amount, percentage, "minDeposit", "maxBonus", requirements, terms, "expiresAt", "isActive", "bannerUrl", "createdAt", "updatedAt") FROM stdin;
cmr69lmtq0000b6u03knzwonb	100% Verified Signup Bonus	Get a 100% bonus added to your wallet on your very first deposit after verifying your email. Use it to play â€” cannot be withdrawn directly.	welcome	\N	100	5	500	Email verification required. Applies to your first deposit.	Bonus funds are added to your wallet balance and can be used to add to your game balance. Not directly withdrawable.	\N	t	\N	2026-07-04 05:44:16.143	2026-07-05 02:43:19.541
cmr69ln590001b6u0s4ul1wyn	30% Regular Deposit Bonus	Get a 30% bonus on every deposit you make (except the first which gets 100%).	deposit	\N	30	5	1000	Applies automatically to all deposits after the first.	Bonus funds are added to your wallet and can be used in-game. Not directly withdrawable.	\N	t	\N	2026-07-04 05:44:16.557	2026-07-05 02:43:19.541
cmr69lngu0002b6u0q7ox5rve	50% Referral Bonus (Max $10)	Earn 50% of your referred friend's first deposit â€” up to $10 â€” added directly to your wallet balance!	referral	\N	50	5	10	Your friend must sign up using your referral link and make their first deposit.	Maximum $10 per referral. Bonus credited to your wallet balance. Can be used in-game but not directly withdrawn.	\N	t	\N	2026-07-04 05:44:16.974	2026-07-05 02:43:19.541
\.


--
-- Data for Name: BonusClaim; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."BonusClaim" (id, "userId", "bonusId", amount, "createdAt") FROM stdin;
cmr7coatk0011ozy91f3f7f3l	cmr7cl0hc000fozy9nbyyy76r	cmr69ln590001b6u0s4ul1wyn	1.5	2026-07-04 23:58:05.576
cmr7ktjky000unggfvs72p25v	cmr6b50aw0003mn9sssynf9dg	cmr69lmtq0000b6u03knzwonb	5	2026-07-05 03:46:07.138
cmr7kv7w8001cnggfy1ri0pl7	cmr6b50aw0003mn9sssynf9dg	cmr69ln590001b6u0s4ul1wyn	1.5	2026-07-05 03:47:25.305
cmrawlv2a003ad1fmvkf8yia1	cmravwyxd001yd1fmakz8rtio	cmr69ln590001b6u0s4ul1wyn	1.5	2026-07-07 11:39:22.69
cmrguct9r00015b6coiz8tl62	cmr69jqsu000012lh99aj857o	cmr69lngu0002b6u0q7ox5rve	10	2026-07-11 15:22:58.287
cmrhp619f0007unsxc1vzme2u	cmr69jqsu000012lh99aj857o	cmr69lmtq0000b6u03knzwonb	10	2026-07-12 11:15:30.148
cmrhp7806000tunsxuylkjcxz	cmr69jqsu000012lh99aj857o	cmr69ln590001b6u0s4ul1wyn	3	2026-07-12 11:16:25.542
\.


--
-- Data for Name: Conversation; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Conversation" (id, conversation_id, user_id, telegram_user_id, telegram_username, telegram_thread_id, source, status, created_at, updated_at) FROM stdin;
cmr7k860c00005rb7uzaitz2q	CONV-6738	\N	6359329105	\N	130	telegram	open	2026-07-05 03:29:29.772	2026-07-05 03:29:30.659
cmr9hkuna001ed1fmon6wvlu2	CONV-1213	\N	7769498305	\N	143	telegram	open	2026-07-06 11:50:55.078	2026-07-06 11:50:56.67
cmravyzj7002dd1fmjx9cf0fg	CONV-5856	cmravwyxd001yd1fmakz8rtio	\N	\N	150	website	open	2026-07-07 11:21:35.395	2026-07-07 11:22:12.304
cmrayg7uz004rd1fmvuw1k7hk	CONV-8592	cmr69jqsu000012lh99aj857o	\N	\N	\N	website	open	2026-07-07 12:30:58.571	2026-07-07 12:30:58.571
cmrcie3cd0005zv5ihz6uegfk	CONV-8466	cmr7cl0hc000fozy9nbyyy76r	\N	\N	178	website	open	2026-07-08 14:36:57.901	2026-07-08 14:37:09.796
cmrgyfww90005gj34bushlcq1	CONV-9616	cmrgtuww2000ecyz8yx2kxdgc	\N	\N	\N	website	open	2026-07-11 22:47:21.417	2026-07-11 22:47:21.417
cmrlrkdka00045qf3eeviu0sz	CONV-4219	\N	7663871829	\N	213	telegram	open	2026-07-15 07:33:43.21	2026-07-15 07:33:44.407
cmrr1r743000d10ff2lnu2gg1	CONV-1853	cmr6b50aw0003mn9sssynf9dg	\N	\N	\N	website	open	2026-07-19 00:17:48.483	2026-07-19 00:17:48.483
cmr7ilszx000063yu1ioqknif	CONV-8019	\N	8075136699	Laurel12o	135	telegram	open	2026-07-05 02:44:06.858	2026-07-20 20:52:58.846
cms7jnpgk000o1354wchv0u74	CONV-6059	cms3gns5x000530c0xul9v2ea	\N	\N	\N	website	open	2026-07-30 13:23:17.54	2026-07-30 13:23:17.54
\.


--
-- Data for Name: Deposit; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Deposit" (id, "userId", amount, currency, "paymentMethodId", status, "transactionId", "paymentReference", "proofImage", notes, "webhookData", "approvedBy", "approvedAt", "rejectedBy", "rejectedAt", "rejectionReason", "telegramMessageId", "telegramChatId", "createdAt", "updatedAt") FROM stdin;
cmshbjr72000rat3af3x077li	cmrgtuww2000ecyz8yx2kxdgc	10	USD	cmsc372yh000112cucdnr5m7p	approved	\N	DEP-1786008837703-15E8387C	\N	ghjk	\N	Admin	2026-08-06 09:34:11.242	\N	\N	\N	306	-1004364345845	2026-08-06 09:33:57.705	2026-08-06 09:34:11.243
cms2w079400016wjsvn5g3jrq	cmr69jqsu000012lh99aj857o	5	USD	\N	failed	\N	DEP-1785136204970-5BDBE253	\N	fghjk	\N	\N	\N	Admin	2026-07-27 07:10:23.143	No payment received	261	-1004364345845	2026-07-27 07:10:04.977	2026-07-27 07:10:23.154
cms2w8xrd000k6wjs0x6nkva9	cmr69jqsu000012lh99aj857o	10	USD	\N	failed	\N	DEP-1785136612579-7C888197	\N	xdgfhgkj	\N	\N	\N	Admin	2026-07-27 07:17:06.234	No payment received	269	-1004364345845	2026-07-27 07:16:52.581	2026-07-27 07:17:06.25
cms3j1upm001730c0pwk67c4q	cmr7cl0hc000fozy9nbyyy76r	10	USD	\N	approved	\N	DEP-1785174913209-83324A54	\N	Martin chad	\N	Admin	2026-07-27 17:55:32.738	\N	\N	\N	277	-1004364345845	2026-07-27 17:55:13.21	2026-07-27 17:55:32.74
cms3jhfdu001c30c0h8ntfwyq	cmr7cl0hc000fozy9nbyyy76r	10	USD	\N	approved	\N	DEP-1785175639841-9A20DEBE	\N	Nick roger	\N	Admin	2026-07-27 18:07:35.483	\N	\N	\N	282	-1004364345845	2026-07-27 18:07:19.842	2026-07-27 18:07:35.484
cms3jjlwz001h30c0upwmns6x	cmr7cl0hc000fozy9nbyyy76r	5	USD	\N	failed	\N	DEP-1785175741618-5AB902E8	\N	Din	\N	\N	\N	Admin	2026-07-27 18:09:11.843	No payment received	285	-1004364345845	2026-07-27 18:09:01.619	2026-07-27 18:09:11.844
cms2wcclr000x6wjsrochuuax	cmr69jqsu000012lh99aj857o	10	USD	\N	failed	\N	DEP-1785136771789-E0D75A5C	\N	cfhgjhkl	\N	\N	\N	Admin	2026-07-27 07:19:43.932	No payment received	274	-1004364345845	2026-07-27 07:19:31.791	2026-07-27 07:19:43.934
cms3gqgw5000m30c0doudlsie	cms3gns5x000530c0xul9v2ea	15	USD	\N	approved	\N	DEP-1785171022850-7339CF11	\N	Chad martin	\N	Admin	2026-07-27 17:55:44.306	\N	\N	\N	276	-1004364345845	2026-07-27 16:50:22.853	2026-07-27 17:55:44.307
cms3kevve00014zzf0txuyz1w	cmr7cl0hc000fozy9nbyyy76r	10	USD	\N	approved	\N	DEP-1785177200856-DDA50229	\N	Chad mikhail 	\N	Admin	2026-07-27 18:33:30.779	\N	\N	\N	287	-1004364345845	2026-07-27 18:33:20.859	2026-07-27 18:33:30.78
cmr7a9awk0003118gof893m4n	cmr6b50aw0003mn9sssynf9dg	10	USD	\N	failed	\N	DEP-1783225226611-85C54DDC	\N	jolene	\N	\N	\N	TM	2026-07-04 22:50:50.908	No payment received	98	-1004364345845	2026-07-04 22:50:26.612	2026-07-04 22:50:50.909
cmr7aadct000a118gqndqidn3	cmr6b50aw0003mn9sssynf9dg	10	USD	\N	approved	\N	DEP-1783225276443-690CAAB9	\N	jolene	\N	TM	2026-07-04 22:51:26.222	\N	\N	\N	100	-1004364345845	2026-07-04 22:51:16.445	2026-07-04 22:51:26.224
cmrbuazj2000891gfs9jbfimw	cmr69jqsu000012lh99aj857o	10	USD	\N	failed	\N	DEP-1783500762202-B0BB9B38	\N	admin	\N	\N	\N	TM	2026-07-08 03:22:48.864	No payment received	164	-1004364345845	2026-07-08 03:22:42.206	2026-07-08 03:22:48.866
cmr7axixd000fconqesd0gb3m	cmr6b50aw0003mn9sssynf9dg	10	USD	\N	failed	\N	DEP-1783226356749-59D67078	\N	jolene	\N	\N	\N	TM	2026-07-04 23:09:24.919	No payment received	107	-1004364345845	2026-07-04 23:09:16.753	2026-07-04 23:09:24.921
cmr7cmoym000qozy9glxzqb81	cmr7cl0hc000fozy9nbyyy76r	10	USD	\N	approved	\N	DEP-1783229210588-DF86D69D	\N	Anna	\N	TM	2026-07-04 23:57:20.441	\N	\N	\N	109	-1004364345845	2026-07-04 23:56:50.59	2026-07-04 23:57:20.442
cmr7fmkc500097di6nl47wdb8	cmr7cl0hc000fozy9nbyyy76r	10	USD	\N	approved	\N	DEP-1783234243443-167C395B	\N	Joele	\N	TM	2026-07-05 01:20:59.841	\N	\N	\N	111	-1004364345845	2026-07-05 01:20:43.445	2026-07-05 01:20:59.842
cmrbubs3w000f91gfw917almx	cmr69jqsu000012lh99aj857o	10	USD	\N	failed	\N	DEP-1783500799241-2A5C9DEC	\N	nick	\N	\N	\N	TM	2026-07-08 03:23:23.659	No payment received	166	-1004364345845	2026-07-08 03:23:19.244	2026-07-08 03:23:23.66
cmr7gy7wm0007tdkayrjkjdfc	cmr7cl0hc000fozy9nbyyy76r	25	USD	\N	approved	\N	DEP-1783236466820-85D7BC90	\N	Jolene	\N	TM	2026-07-05 01:58:00.931	\N	\N	\N	113	-1004364345845	2026-07-05 01:57:46.822	2026-07-05 01:58:00.933
cmr7kqfew0009nggf7xrhqjv1	cmr6b50aw0003mn9sssynf9dg	10	USD	\N	approved	\N	DEP-1783242821766-E00EA321	\N	Lauren	\N	TM	2026-07-05 03:43:54.082	\N	\N	\N	141	-1004364345845	2026-07-05 03:43:41.768	2026-07-05 03:43:54.083
cmrawgdbv002xd1fmvl544fds	cmravwyxd001yd1fmakz8rtio	10	USD	\N	approved	\N	DEP-1783443906425-AE7C948D	\N	Red	\N	TM	2026-07-07 11:35:21.887	\N	\N	\N	154	-1004364345845	2026-07-07 11:35:06.427	2026-07-07 11:35:21.888
cmrbvfk5400053y6suvqb1wn0	cmr69jqsu000012lh99aj857o	10	USD	\N	failed	\N	DEP-1783502655157-60598AA1	\N	din	\N	\N	\N	TM	2026-07-08 03:54:32.466	No payment received	168	-1004364345845	2026-07-08 03:54:15.16	2026-07-08 03:54:32.469
cmraxmyiz003kd1fmzv5x8unt	cmravwyxd001yd1fmakz8rtio	10	USD	\N	approved	\N	DEP-1783445893450-0D0FAC89	\N	Red	\N	@nick9851	2026-07-07 12:13:36.371	\N	\N	\N	156	-1004364345845	2026-07-07 12:08:13.451	2026-07-07 12:13:36.373
cmraxw7fw003xd1fmj1fr7afx	cmravwyxd001yd1fmakz8rtio	25	USD	\N	failed	\N	DEP-1783446324907-905106C0	\N	Rad	\N	\N	\N	@nick9851	2026-07-07 12:15:42.238	No payment received	158	-1004364345845	2026-07-07 12:15:24.908	2026-07-07 12:15:42.239
cmraxzq890044d1fmj3x16akw	cmravwyxd001yd1fmakz8rtio	50	USD	\N	approved	\N	DEP-1783446489224-542443D2	\N	Rad	\N	@nick9851	2026-07-07 12:18:20.247	\N	\N	\N	160	-1004364345845	2026-07-07 12:18:09.225	2026-07-07 12:18:20.248
cmrbu45te000191gf5gmrtt9z	cmr69jqsu000012lh99aj857o	10	USD	\N	failed	\N	DEP-1783500443748-B5F5989E	\N	nick roger	\N	\N	\N	TM	2026-07-08 03:17:41.031	No payment received	162	-1004364345845	2026-07-08 03:17:23.751	2026-07-08 03:17:41.032
cmrqz6syk000511m6gczs5gpc	cmr69jqsu000012lh99aj857o	10	USD	\N	failed	\N	DEP-1784415957737-9CD69FBB	\N	nick roger	\N	\N	\N	TM	2026-07-18 23:06:23.015	No payment received	216	-1004364345845	2026-07-18 23:05:57.787	2026-07-18 23:06:23.018
cmrr1ve41000h10ffkmczc3ud	cmr6b50aw0003mn9sssynf9dg	10	USD	\N	failed	\N	DEP-1784420464175-1EBC9111	\N	Nick captain 	\N	\N	\N	TM	2026-07-19 00:21:24.232	No payment received	218	-1004364345845	2026-07-19 00:21:04.177	2026-07-19 00:21:24.233
cmrgrgho40001w7eyy5ersy6b	cmr69jqsu000012lh99aj857o	18	USD	\N	approved	<4feJnU7aTtC8YUUVoXtUSQ@geopod-ismtpd-28>	DEP-1783798311008-8AF6883C	\N	Melinda Swiz	\N	system_imap	2026-07-11 14:02:37.086	\N	\N	\N	\N	\N	2026-07-11 14:01:51.028	2026-07-11 14:02:37.094
cmrcjm52x000fzv5ic28rt219	cmravwyxd001yd1fmakz8rtio	10	USD	\N	failed	\N	DEP-1783543273015-AD14D188	\N	phyllis butler	\N	\N	\N	TM	2026-07-08 15:12:35.172	No payment received	182	-1004364345845	2026-07-08 15:11:13.017	2026-07-08 15:12:35.173
cmrcg1vyd00071uvaue3lfngn	cmr69jqsu000012lh99aj857o	10	USD	\N	failed	\N	DEP-1783537289219-C7952C64	\N	Chad M	\N	\N	\N	TM	2026-07-08 13:32:08.803	No payment received	170	-1004364345845	2026-07-08 13:31:29.221	2026-07-08 13:32:08.805
cmrcjmuqc000kzv5iikfsb7rr	cmr6b50aw0003mn9sssynf9dg	10	USD	\N	approved	\N	DEP-1783543306259-1B6A10B3	\N	Phyllis B	\N	system_imap	2026-07-08 15:15:51.423	\N	\N	\N	183	-1004364345845	2026-07-08 15:11:46.26	2026-07-08 15:15:51.425
cmrch0fce000e1uvagvxg8js0	cmr69jqsu000012lh99aj857o	10	USD	\N	failed	\N	DEP-1783538900652-C2A4792B	\N	chad m	\N	\N	\N	TM	2026-07-08 13:58:37.329	No payment received	172	-1004364345845	2026-07-08 13:58:20.655	2026-07-08 13:58:37.332
cmrgtw70d000tcyz8v7wlnq27	cmrgtuww2000ecyz8yx2kxdgc	25	USD	\N	approved	\N	DEP-1783802402938-01EA2F43	\N	chad m	\N	TM	2026-07-11 15:12:36.956	\N	\N	\N	201	-1004364345845	2026-07-11 15:10:02.941	2026-07-11 15:12:36.958
cmrchqy4c0003hloaii1qbdg6	cmr69jqsu000012lh99aj857o	10	USD	\N	failed	\N	DEP-1783540138042-0E0BC24D	\N	chad m	\N	\N	\N	TM	2026-07-08 14:19:52.783	No payment received	176	-1004364345845	2026-07-08 14:18:58.044	2026-07-08 14:19:52.785
cmrddlo0g000vzv5i7s3erzpc	cmr6b50aw0003mn9sssynf9dg	10	USD	\N	approved	<LQA-srzKQ36tidLHz7Xzog@geopod-ismtpd-103>	DEP-1783593639375-F18B4C2F	\N	Luz cameron	\N	system_imap	2026-07-09 05:12:17.676	\N	\N	\N	186	-1004364345845	2026-07-09 05:10:39.377	2026-07-09 05:12:17.678
cmrgrioa10007w7eymdv8pbn2	cmr69jqsu000012lh99aj857o	18	USD	\N	failed	\N	DEP-1783798412903-B9D0F185	\N	Melinda Swiz	\N	\N	\N	TM	2026-07-11 14:07:21.294	No payment received	193	-1004364345845	2026-07-11 14:03:32.905	2026-07-11 14:07:21.296
cmrgr6l2o0001cyz8fs7trvss	cmr69jqsu000012lh99aj857o	18	USD	\N	failed	\N	DEP-1783797848877-36D6833B	\N	melinda swiz	\N	\N	\N	TM	2026-07-11 13:57:18.548	No payment received	190	-1004364345845	2026-07-11 13:54:08.88	2026-07-11 13:57:18.55
cmrgs6ile000askz9jq9ezmo9	cmr69jqsu000012lh99aj857o	10	USD	\N	failed	\N	DEP-1783799525281-3529FBC8	\N	melinda s	\N	\N	\N	TM	2026-07-11 14:29:26.195	No payment received	197	-1004364345845	2026-07-11 14:22:05.282	2026-07-11 14:29:26.196
cmrgs4k8i0001skz9kgkr5dd9	cmr69jqsu000012lh99aj857o	20	USD	\N	approved	\N	DEP-1783799434083-84A28B7B	\N	Melinda Swiz	\N	TM	2026-07-11 14:20:48.383	\N	\N	\N	195	-1004364345845	2026-07-11 14:20:34.086	2026-07-11 14:20:48.385
cmrhq63nm001bunsxbrkb9cti	cmr69jqsu000012lh99aj857o	10	USD	\N	approved	\N	DEP-1783856612864-35841AFB	\N	luci chad	\N	TM	2026-07-12 11:43:45.783	\N	\N	\N	208	-1004364345845	2026-07-12 11:43:32.867	2026-07-12 11:43:45.786
cmrch63ia000l1uvanlgpluoy	cmr69jqsu000012lh99aj857o	10	USD	\N	failed	\N	DEP-1783539165248-052B4183	\N	chad b	\N	\N	\N	TM	2026-07-08 14:02:55.94	No payment received	174	-1004364345845	2026-07-08 14:02:45.25	2026-07-08 14:02:55.942
cmrr29gdo000712lg9kvpc932	cmr6b50aw0003mn9sssynf9dg	10	USD	\N	failed	\N	DEP-1784421120298-99098AAD	\N	Nick	\N	\N	\N	TM	2026-07-19 00:32:19.572	No payment received	220	-1004364345845	2026-07-19 00:32:00.3	2026-07-19 00:32:19.573
cmrrrt8zr0002zbtxdzhzo5l8	cmrqzvdm100056ihjug2ahews	5	USD	\N	approved	\N	\N	\N	Admin Manual Credit: reimburse	\N	cmr69jqsu000012lh99aj857o	2026-07-19 12:27:14.24	\N	\N	\N	\N	\N	2026-07-19 12:27:14.248	2026-07-19 12:27:14.248
cmrrrvlru0006zbtx42kyrrdn	cmr6b50aw0003mn9sssynf9dg	5	USD	\N	approved	\N	\N	\N	Admin Manual Credit: reimburse	\N	cmr69jqsu000012lh99aj857o	2026-07-19 12:29:04.12	\N	\N	\N	\N	\N	2026-07-19 12:29:04.122	2026-07-19 12:29:04.122
cmsc3liw4000579ufe7m4d1yx	cmr6b50aw0003mn9sssynf9dg	10	USD	cmsc371jd000012cu1qx6weh6	failed	\N	DEP-1785693152721-5D77C6CC	\N	chad m	\N	\N	\N	Admin	2026-08-02 17:53:07.707	No payment received	295	-1004364345845	2026-08-02 17:52:32.734	2026-08-02 17:53:07.71
cmsdo5hqf0003kutgie86yd7i	cmr69jqsu000012lh99aj857o	10	USD	cmsc371jd000012cu1qx6weh6	failed	\N	DEP-1785788142847-AE933820	\N	laluyadav	\N	\N	\N	Admin	2026-08-03 20:15:59.955	No payment received	297	-1004364345845	2026-08-03 20:15:42.856	2026-08-03 20:15:59.959
cmsdsm1ea00034w61wxjn9sxi	cmr69jqsu000012lh99aj857o	10	USD	cmsc371jd000012cu1qx6weh6	approved	\N	DEP-1785795633296-0DF04157	\N	hgfjghfbdcsx	\N	Admin	2026-08-03 22:20:48.154	\N	\N	\N	299	-1004364345845	2026-08-03 22:20:33.299	2026-08-03 22:20:48.155
\.


--
-- Data for Name: DepositTransaction; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."DepositTransaction" (id, "depositId", "providerId", "transactionRef", status, amount, currency, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: FAQ; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."FAQ" (id, question, answer, category, "order", "isActive", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: Game; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Game" (id, name, description, category, version, "downloadUrl", "downloadCount", "isActive", "isFeatured", "thumbnailUrl", screenshots, requirements, instructions, rating, "providerId", "createdAt", "updatedAt") FROM stdin;
cmr7bq1f6000vconqd3w1j2j5	Firekirin		Action	1.0.0	http://start.firekirin.xyz:8580/	4	t	t	https://images.nightcafe.studio/ik-seo/jobs/zGJVfP29qdNwsMfIm3Y4/zGJVfP29qdNwsMfIm3Y4--1--0l742/fire-kirin.jpg?tr=w-1600,c-at_max	{}	\N	\N	4.5	\N	2026-07-04 23:31:27.09	2026-07-11 14:46:50.426
cmr7b4tdk000sconqbh7yehhf	Juwa		Action	1.0.0	https://dl.juwa777.com/	3	t	t	https://juwa777.to/wp-content/uploads/2025/08/juwa-777.webp	{}	\N	\N	4.5	cmr7lwt20002rnggfbn8d7kil	2026-07-04 23:14:56.888	2026-07-11 22:54:25.81
cmrhlq8tp0004wtnpoyxf1t4a	Milkyway		Action	1.0.0	https://milkywayapp.xyz/	0	t	t	https://gamblespot-images.s3.amazonaws.com/fish+table+games/milky+way/Milky+Way_Picture+square_800x800.webp	{}	\N	\N	4.5	\N	2026-07-12 09:39:14.605	2026-07-12 09:41:53.971
cmr7bkks5000uconqpracov3x	Juwa 2.0		Action	1.0.0	https://m.juwa2.com/	0	t	t	https://juwa6.net/wp-content/uploads/2026/04/Juwa2.0.org-logo.png	{}	\N	\N	4.5	cmr5ffgpe000mqs55ym8xwjyg	2026-07-04 23:27:12.246	2026-07-12 09:44:49.485
cmrhm3rkc0005wtnp8ovvs541	Yolo 777		Action	1.0.0	https://yolo777.game/	1	t	t	https://www.image2url.com/r2/default/images/1783849771154-013bbab3-8fdb-4ca4-821f-2650088501f6.png	{}	\N	\N	4.5	\N	2026-07-12 09:49:45.364	2026-07-12 09:50:01.476
cmrhm76gi0008wtnp5jq5nbop	Cashmachine		Action	1.0.0	https://www.cashmachine777.com/	0	t	t	https://cashmachine777.net/wp-content/uploads/Background-Image-scaled.webp	{}	\N	\N	4.5	\N	2026-07-12 09:52:24.69	2026-07-12 09:52:24.69
cmrhmbuj7000awtnpy4nd3vek	Pandamaster		Action	1.0.0	https://play.pandamaster.vip/web_game/pandamaster777_pc/index.html	0	t	t	https://ats.io/wp-content/uploads/2024/02/Panda-Master-Casino-1024x704.jpg	{}	\N	\N	4.5	\N	2026-07-12 09:56:02.515	2026-07-12 09:56:02.515
cmrhma6d50009wtnplnok1d7y	Ultrapanda		Action	1.0.0	www.ultrapanda.club	0	t	t	https://ultrapandasupport.com/wp-content/uploads/2025/11/ultrapanda-logo-without-background-.png	{}	\N	\N	4.5	\N	2026-07-12 09:54:44.48	2026-07-12 09:58:48.158
cmr7bfqqp000tconqypy0wu5j	Vegas Sweeps		Action	1.0.0	https://m.lasvegassweeps.com/	1	t	t	https://www.image2url.com/r2/default/images/1783227175705-0f6f505b-437d-4a09-9bae-19237330e925.png	{}	\N	\N	4.5	cmr5fjihw000vqs55y8i87kv5	2026-07-04 23:23:26.689	2026-07-27 05:32:38.054
cms2v9t850007d2ivh726oqgj	Game Room		Action	1.0.0	https://www.gameroom777.com/	0	t	t	https://www.image2url.com/r2/default/images/1785134945887-310a6271-5036-4200-89b4-118b7e76c9b4.png	{}	\N	\N	4.5	\N	2026-07-27 06:49:33.749	2026-07-27 06:49:33.749
cms2vhpqw0008d2iv9q5f5gnc	River Sweeps		Action	1.0.0	https://river777.com/	0	t	t	https://sp-ao.shortpixel.ai/client/to_webp,q_glossy,ret_img,w_600,h_600/https://galacticsweeps.net/wp-content/uploads/2025/07/River-Sweeps-777.webp	{}	\N	\N	4.5	\N	2026-07-27 06:55:42.488	2026-07-27 07:00:30.455
cmrdm481r0002fotg543thkmt	Vblink		Action	1.0.0	https://www.vblink777.club/	0	t	t	https://www.getmodsapk.cc/wp-content/uploads/2025/01/vblink777-app.webp	{}	\N	\N	4.5	\N	2026-07-09 09:09:02.079	2026-07-12 09:45:41.125
cmr7b0mow000nconqc8w4g5cm	Game Vault		Action	1.0.0	https://download.gamevault999.com/	6	t	t	https://miro.medium.com/v2/1*S0ucmYrK6O_znVAQ4pe7Og.png	{}	\N	\N	4.5	cmr69xaxy0000yfqf0lk4ujmo	2026-07-04 23:11:41.6	2026-07-30 13:21:19.546
cms2v21ee0006d2iviipkoabv	Orion Star		Action	1.0.0	http://start.orionstars.vip:8580/index.html	0	t	t	https://imgcdn.latestmodapks.com/api/resize?url=https://www.latestmodapks.com/wp-content/uploads/2024/08/Orion-Stars-777-APK-1-media.jpg&height=250	{}	\N	\N	4.5	cmsfvgxvr00087y6fy1hmp5x7	2026-07-27 06:43:31.092	2026-08-06 10:46:23.212
\.


--
-- Data for Name: GameDownload; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."GameDownload" (id, "userId", "gameId", "createdAt") FROM stdin;
cmr7dwjmt000twf3uzp21epzv	cmr7cl0hc000fozy9nbyyy76r	cmr7b0mow000nconqc8w4g5cm	2026-07-05 00:32:28.133
cmr8ukn7m00053h49j3ywb4te	cmr69jqsu000012lh99aj857o	cmr7b4tdk000sconqbh7yehhf	2026-07-06 01:06:54.121
cmraw2d2i002ld1fmeyjz9u1b	cmravwyxd001yd1fmakz8rtio	cmr7b0mow000nconqc8w4g5cm	2026-07-07 11:24:12.492
cmraybeuu004pd1fm4ao7352d	cmravwyxd001yd1fmakz8rtio	cmr7b4tdk000sconqbh7yehhf	2026-07-07 12:27:13.975
cmre4693f0012zv5ifpjeqakn	cmravwyxd001yd1fmakz8rtio	cmr7bfqqp000tconqypy0wu5j	2026-07-09 17:34:29.444
cmrgsct0z000fskz9rlsfrs5g	cmr69jqsu000012lh99aj857o	cmr7bq1f6000vconqd3w1j2j5	2026-07-11 14:26:58.598
cmrgyp0g80001wtnp5mdix786	cmrgtuww2000ecyz8yx2kxdgc	cmr7b4tdk000sconqbh7yehhf	2026-07-11 22:54:25.81
cmrhm441b0007wtnp7ex16gyb	cmr7cl0hc000fozy9nbyyy76r	cmrhm3rkc0005wtnp8ovvs541	2026-07-12 09:50:01.476
cms7jl6i4000g1354mgh3t9ds	cms7jkbiu00051354c1gpeu4h	cmr7b0mow000nconqc8w4g5cm	2026-07-30 13:21:19.546
\.


--
-- Data for Name: Message; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Message" (id, conversation_id, sender_type, message, created_at) FROM stdin;
cmr7iluhx000263yuzd8g0xsk	cmr7ilszx000063yu1ioqknif	user	hello	2026-07-05 02:44:08.793
cmr7im4vj000463yulnva11fq	cmr7ilszx000063yu1ioqknif	agent	Yee	2026-07-05 02:44:22.255
cmr7imbat000663yua9dfinwp	cmr7ilszx000063yu1ioqknif	agent	How can I help you	2026-07-05 02:44:30.581
cmr7imiqc000863yulacsfgvo	cmr7ilszx000063yu1ioqknif	user	i wanna cashout	2026-07-05 02:44:40.213
cmr7in02j000a63yuep70nz6b	cmr7ilszx000063yu1ioqknif	agent	Go through the details provided in website	2026-07-05 02:45:02.683
cmr7in4w9000c63yuqorvs2y0	cmr7ilszx000063yu1ioqknif	user	okay	2026-07-05 02:45:08.938
cmr7in7b7000e63yu4iakq58v	cmr7ilszx000063yu1ioqknif	user	thank you	2026-07-05 02:45:12.067
cmr7ine5m000g63yugbitv2p3	cmr7ilszx000063yu1ioqknif	agent	Welcome	2026-07-05 02:45:20.938
cmr7inio7000i63yuq2lu2ci7	cmr7ilszx000063yu1ioqknif	agent	Always in your service	2026-07-05 02:45:26.791
cmr7ix98j0001upef1frl3v0i	cmr7ilszx000063yu1ioqknif	user	hi	2026-07-05 02:53:01.123
cmr7izkv30005upefgmwzc1m7	cmr7ilszx000063yu1ioqknif	user	hi	2026-07-05 02:54:49.503
cmr7j054t0007upeft0uwgt77	cmr7ilszx000063yu1ioqknif	user	hi	2026-07-05 02:55:15.773
cmr7j1ixq0009upefemggflv9	cmr7ilszx000063yu1ioqknif	user	hi	2026-07-05 02:56:20.319
cmr7j4du0000bupef3l6u7tzx	cmr7ilszx000063yu1ioqknif	user	hi	2026-07-05 02:58:33.672
cmr7jp9a70003syif0qsa67gu	cmr7ilszx000063yu1ioqknif	user	hi	2026-07-05 03:14:47.551
cmr7jx4kx0003gnzjktdxhw4l	cmr7ilszx000063yu1ioqknif	user	hi	2026-07-05 03:20:54.706
cmr7k3a5o0001mm3nmw1cy9e4	cmr7ilszx000063yu1ioqknif	user	Hi	2026-07-05 03:25:41.868
cmr7k5cao00036xsxix1fmsa2	cmr7ilszx000063yu1ioqknif	user	/start	2026-07-05 03:27:17.952
cmr7k5f6900056xsxym9yuyvb	cmr7ilszx000063yu1ioqknif	user	Hi	2026-07-05 03:27:21.681
cmr7k6p0200076xsx2zn5kbyk	cmr7ilszx000063yu1ioqknif	user	Hi	2026-07-05 03:28:21.075
cmr7k757u00096xsxo4s857iv	cmr7ilszx000063yu1ioqknif	user	Hi	2026-07-05 03:28:42.09
cmr7k7n1c0001gflselp2ncod	cmr7ilszx000063yu1ioqknif	user	Hi	2026-07-05 03:29:05.181
cmr7k87d600025rb773kwjzk2	cmr7k860c00005rb7uzaitz2q	user	Hi	2026-07-05 03:29:31.53
cmr7k8hj000045rb7das5tztx	cmr7k860c00005rb7uzaitz2q	agent	Hello	2026-07-05 03:29:44.641
cmr7k8z3q00065rb74ih55kil	cmr7ilszx000063yu1ioqknif	user	/start	2026-07-05 03:30:07.478
cmr7k90t300085rb7e5thyypz	cmr7ilszx000063yu1ioqknif	user	Hi	2026-07-05 03:30:09.687
cmr7k940m000a5rb7sq8boaiz	cmr7ilszx000063yu1ioqknif	user	Baby	2026-07-05 03:30:13.847
cmr7kb82k0003ejsrq7er8yxo	cmr7ilszx000063yu1ioqknif	user	/start	2026-07-05 03:31:52.412
cmr7kbr9u0005ejsrz3sbait0	cmr7k860c00005rb7uzaitz2q	user	Hi	2026-07-05 03:32:17.298
cmr7kjsg100013g4vgls2ckq9	cmr7ilszx000063yu1ioqknif	user	/start	2026-07-05 03:38:32.066
cmr7kjvsv00033g4vhb70ld4t	cmr7ilszx000063yu1ioqknif	user	Hi	2026-07-05 03:38:36.416
cmr7kk6xk00053g4v79l2auml	cmr7ilszx000063yu1ioqknif	user	hi	2026-07-05 03:38:50.841
cmr7kocmf0001nggf9bz7ps2p	cmr7ilszx000063yu1ioqknif	user	/start	2026-07-05 03:42:04.84
cmr7kohdl0003nggf6do4j5rt	cmr7ilszx000063yu1ioqknif	user	Hi	2026-07-05 03:42:11.001
cmr7koigv0005nggfz0tvkz3c	cmr7ilszx000063yu1ioqknif	user	Boss	2026-07-05 03:42:12.415
cmr7kozbg0007nggfxq1w3kz9	cmr7k860c00005rb7uzaitz2q	user	Hi	2026-07-05 03:42:34.253
cmr9hkxez001gd1fmmvmsm88p	cmr9hkuna001ed1fmon6wvlu2	user	/start	2026-07-06 11:50:58.667
cmr9hl0b1001id1fmy654055h	cmr9hkuna001ed1fmon6wvlu2	user	Hi	2026-07-06 11:51:02.414
cmr9hl5to001kd1fmgfhcz7if	cmr9hkuna001ed1fmon6wvlu2	agent	Hello	2026-07-06 11:51:09.357
cmr9hlehs001md1fm9qvtnf40	cmr9hkuna001ed1fmon6wvlu2	agent	How can we help you	2026-07-06 11:51:20.8
cmr9hm9s4001od1fmhtwrhlkj	cmr9hkuna001ed1fmon6wvlu2	agent	Hello	2026-07-06 11:52:01.348
cmravzpnx002fd1fm7e0ileep	cmravyzj7002dd1fmjx9cf0fg	user	Hi	2026-07-07 11:22:09.261
cmraw0ebw002hd1fmx6q7yqe3	cmravyzj7002dd1fmjx9cf0fg	agent	Hello	2026-07-07 11:22:41.228
cmrcie9bt0007zv5ikj8xa6e7	cmrcie3cd0005zv5ihz6uegfk	user	Hi	2026-07-08 14:37:05.657
cmrcieude0009zv5ifsfzwcb2	cmrcie3cd0005zv5ihz6uegfk	agent	Hello	2026-07-08 14:37:32.93
cmrlrkf3w00065qf3arrgl2c0	cmrlrkdka00045qf3eeviu0sz	user	/start	2026-07-15 07:33:45.212
cmrrqidsj0005ypvwm6gu0d1k	cmr7ilszx000063yu1ioqknif	user	hi	2026-07-19 11:50:47.635
cmrrqjhct0007ypvwh178nus6	cmr7ilszx000063yu1ioqknif	agent	Hello	2026-07-19 11:51:38.909
cmrrqjpem0009ypvwg1chdu3l	cmr7ilszx000063yu1ioqknif	user	hi	2026-07-19 11:51:49.342
cmrrr40n10001sq6mt07an255	cmr7k860c00005rb7uzaitz2q	user	Hi	2026-07-19 12:07:37.021
cmrrrrxdc0001139v9zuqnj35	cmr7k860c00005rb7uzaitz2q	user	Hi	2026-07-19 12:26:12.528
cmrrrx2880003139vbgcfh2ex	cmr7ilszx000063yu1ioqknif	user	Hello	2026-07-19 12:30:12.104
cmrtoo3hj00016wvnzfhzdc30	cmr7ilszx000063yu1ioqknif	user	Hi	2026-07-20 20:34:47.325
cmrtoo4ve00056wvnngfr1wwo	cmr7ilszx000063yu1ioqknif	user	Hello	2026-07-20 20:34:49.13
cmrtoo4v900036wvnispeny4c	cmr7ilszx000063yu1ioqknif	user	Hello	2026-07-20 20:34:49.126
cmrtoos9000076wvnv6h4m8hl	cmr7ilszx000063yu1ioqknif	user	hi	2026-07-20 20:35:19.429
cmrtorwxr0001fwbm7p0cnnyg	cmr7ilszx000063yu1ioqknif	user	hello	2026-07-20 20:37:45.466
cmrtos8uy0003fwbmo8cfgo6g	cmr7ilszx000063yu1ioqknif	user	hi	2026-07-20 20:38:00.922
cmrtosh560005fwbmlls22nr4	cmr7ilszx000063yu1ioqknif	agent	Yes	2026-07-20 20:38:11.658
cmrtosnvp0007fwbmys777pdj	cmr7ilszx000063yu1ioqknif	agent	How can we help	2026-07-20 20:38:20.39
cmrtov6ig0003azeslzjfj4fu	cmr7ilszx000063yu1ioqknif	user	yes sir	2026-07-20 20:40:17.848
cmrtovgtn0005azes7x5fl8b7	cmr7ilszx000063yu1ioqknif	agent	I want to make deposit	2026-07-20 20:40:31.212
cmrtovrsj0007azesiqzklzk5	cmr7ilszx000063yu1ioqknif	agent	Response is getting time	2026-07-20 20:40:45.165
cmrtow0i80009azes1yxrw134	cmr7ilszx000063yu1ioqknif	agent	It's late	2026-07-20 20:40:56.72
cmrtp7nyp0001duozf0bfcouh	cmr7ilszx000063yu1ioqknif	agent	Hi	2026-07-20 20:50:00.337
cmrtp93hp0001ugt0h3v7rgun	cmr7ilszx000063yu1ioqknif	user	hi	2026-07-20 20:51:07.117
cmrtp9brn0003ugt06pftzu3l	cmr7ilszx000063yu1ioqknif	agent	I need help	2026-07-20 20:51:17.843
cmrtp9i9b0005ugt0pyrwtjbh	cmr7ilszx000063yu1ioqknif	user	yes	2026-07-20 20:51:26.255
cmrtp9umd0007ugt066xlkwsg	cmr7ilszx000063yu1ioqknif	user	how can we help	2026-07-20 20:51:42.277
cmrtpbjy6000bugt0cf1ylaqq	cmr7ilszx000063yu1ioqknif	user	hi	2026-07-20 20:53:01.758
cmrtpgj6h00013o3n58cmya1c	cmr7ilszx000063yu1ioqknif	agent	Hello	2026-07-20 20:56:54.042
cmrtpgnfi00033o3n1q24ldew	cmr7ilszx000063yu1ioqknif	user	Yes	2026-07-20 20:56:59.55
cmrtpgsoh00053o3ns3rqlzts	cmr7ilszx000063yu1ioqknif	agent	Good	2026-07-20 20:57:06.353
cmrtph2va00073o3ncbl3fdrx	cmr7ilszx000063yu1ioqknif	agent	Yes	2026-07-20 20:57:19.558
cmrtpha3b00093o3nss1yc4n7	cmr7ilszx000063yu1ioqknif	user	you good	2026-07-20 20:57:28.92
cmrtphd8v000b3o3n356504d0	cmr7ilszx000063yu1ioqknif	agent	You	2026-07-20 20:57:33.007
cmrtpvvfg000d3o3nk9trrnrw	cmr7ilszx000063yu1ioqknif	user	[Media/Attachment]	2026-07-20 21:08:49.756
cmrtpzfjn000f3o3nz8ryk1f1	cmr7ilszx000063yu1ioqknif	user	[Media/Attachment]	2026-07-20 21:11:35.796
cmrtq0q1g000h3o3nav76jcan	cmr7ilszx000063yu1ioqknif	agent	https://www.facebook.com/Vaultsweeps	2026-07-20 21:12:36.052
cmrzbe9z10001jaf73qe745jq	cmr7k860c00005rb7uzaitz2q	user	Hi	2026-07-24 19:09:51.229
cmrzbehnq0003jaf7i9utu2vi	cmr7k860c00005rb7uzaitz2q	agent	How are you	2026-07-24 19:10:01.19
cmrzben3b0005jaf7qo2phmlk	cmr7k860c00005rb7uzaitz2q	user	Good	2026-07-24 19:10:08.232
cms3lx87t000g4zzfpcwjqed2	cmr7k860c00005rb7uzaitz2q	user	Hi	2026-07-27 19:15:36.281
cms3lxdya000i4zzfwno8gbdj	cmr7k860c00005rb7uzaitz2q	agent	Hello	2026-07-27 19:15:43.714
cmsdsotyt000a4w615rbhfra6	cmr7ilszx000063yu1ioqknif	user	hi	2026-08-03 22:22:43.638
cmsdsp9p9000c4w61bshrgeoy	cmr7ilszx000063yu1ioqknif	agent	Yes	2026-08-03 22:23:04.028
cmsdspdg5000e4w61m8u7na7u	cmr7ilszx000063yu1ioqknif	agent	How can we help you	2026-08-03 22:23:08.886
cmsdspobi000g4w615n37sj13	cmr7ilszx000063yu1ioqknif	user	thank uo	2026-08-03 22:23:22.974
cmsdsprzc000i4w61pwru2nnd	cmr7ilszx000063yu1ioqknif	agent	Welcome	2026-08-03 22:23:27.72
\.


--
-- Data for Name: Notification; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Notification" (id, "userId", title, message, type, "isRead", link, "createdAt") FROM stdin;
cmsdsm36j00064w61vgtd8ic4	cmr69jqsu000012lh99aj857o	Deposit Submitted	Your deposit of $10 is being processed.	info	t	/dashboard/deposits	2026-08-03 22:20:35.61
cms2w917q000n6wjstlz4o2sa	cmr69jqsu000012lh99aj857o	Deposit Submitted	Your deposit of $10 is being processed.	info	t	/dashboard/deposits	2026-07-27 07:16:57.062
cms2w99jg000p6wjsnkovdrpd	cmr69jqsu000012lh99aj857o	âŒ Deposit Failed	Your deposit of $10.00 was rejected. Reason: No payment received. Contact support if needed.	error	t	/dashboard/deposits	2026-07-27 07:17:07.586
cms2w0ajv00046wjshp24f99h	cmr69jqsu000012lh99aj857o	Deposit Submitted	Your deposit of $5 is being processed.	info	t	/dashboard/deposits	2026-07-27 07:10:09.259
cmrhqo8v1000612i3v2y75kgh	cmr69jqsu000012lh99aj857o	âŒ Withdrawal Rejected	Your withdrawal request WD-20260712-Y8B6X0CY for $9.00 was rejected. Reason: Incorrect details Contact support for help.	error	t	/dashboard/withdrawals	2026-07-12 11:57:39.421
cms3gqhl1000p30c0pjv584tp	cms3gns5x000530c0xul9v2ea	Deposit Submitted	Your deposit of $15 is being processed.	info	f	/dashboard/deposits	2026-07-27 16:50:23.748
cmrddlqfl000yzv5imbs599rc	cmr6b50aw0003mn9sssynf9dg	Deposit Submitted	Your deposit of $10 is being processed.	info	t	/dashboard/deposits	2026-07-09 05:10:42.514
cmr7a9bv10006118g8elo4xxk	cmr6b50aw0003mn9sssynf9dg	Deposit Submitted	Your deposit of $10 via Zappay has been submitted and is pending review.	info	t	/dashboard/deposits	2026-07-04 22:50:27.853
cmrawgq240032d1fme8hx13fz	cmravwyxd001yd1fmakz8rtio	âœ… Deposit Approved!	Your deposit of $10.00 has been approved and added to your balance.	success	f	/dashboard/deposits	2026-07-07 11:35:22.925
cmraxn0yq003nd1fm1zlqvddg	cmravwyxd001yd1fmakz8rtio	Deposit Submitted	Your deposit of $10 is being processed.	info	f	/dashboard/deposits	2026-07-07 12:08:16.609
cmrawgfxi0030d1fmb88urcp3	cmravwyxd001yd1fmakz8rtio	Deposit Submitted	Your deposit of $10 is being processed.	info	t	/dashboard/deposits	2026-07-07 11:35:09.798
cmraxtwfz003pd1fmj4ghurqd	cmravwyxd001yd1fmakz8rtio	âœ… Deposit Approved!	Your deposit of $10.00 has been approved and added to your balance.	success	f	/dashboard/deposits	2026-07-07 12:13:37.343
cmraxw9u80040d1fmo94u5kxe	cmravwyxd001yd1fmakz8rtio	Deposit Submitted	Your deposit of $25 is being processed.	info	f	/dashboard/deposits	2026-07-07 12:15:28.017
cmraxwljr0042d1fm334z82kt	cmravwyxd001yd1fmakz8rtio	âŒ Deposit Failed	Your deposit of $25.00 was rejected. Reason: No payment received. Contact support if needed.	error	f	/dashboard/deposits	2026-07-07 12:15:43.191
cmraxzsrj0047d1fmz43gp6w2	cmravwyxd001yd1fmakz8rtio	Deposit Submitted	Your deposit of $50 is being processed.	info	f	/dashboard/deposits	2026-07-07 12:18:12.511
cmraxzzgw0049d1fmrhyvzrv2	cmravwyxd001yd1fmakz8rtio	âœ… Deposit Approved!	Your deposit of $50.00 has been approved and added to your balance.	success	f	/dashboard/deposits	2026-07-07 12:18:21.2
cmrgtw9ip000wcyz8yelm3zm1	cmrgtuww2000ecyz8yx2kxdgc	Deposit Submitted	Your deposit of $25 is being processed.	info	t	/dashboard/deposits	2026-07-11 15:10:06.194
cmr7a9txq0008118gyqwyyhnd	cmr6b50aw0003mn9sssynf9dg	âŒ Deposit Failed	Your deposit of $10.00 was rejected. Reason: No payment received. Contact support if needed.	error	t	/dashboard/deposits	2026-07-04 22:50:51.279
cmr7aaeaz000d118gn81byoow	cmr6b50aw0003mn9sssynf9dg	Deposit Submitted	Your deposit of $10 via Zappay has been submitted and is pending review.	info	t	/dashboard/deposits	2026-07-04 22:51:17.676
cmr7aal5o000f118gxyh6jvuf	cmr6b50aw0003mn9sssynf9dg	âœ… Deposit Approved!	Your deposit of $10.00 has been approved and added to your balance.	success	t	/dashboard/deposits	2026-07-04 22:51:26.556
cmrqz6wrw000811m6tuipep7e	cmr69jqsu000012lh99aj857o	Deposit Submitted	Your deposit of $10 is being processed.	info	t	/dashboard/deposits	2026-07-18 23:06:02.732
cmrch0ger000h1uva6251fz4j	cmr69jqsu000012lh99aj857o	Deposit Submitted	Your deposit of $10 is being processed.	info	t	/dashboard/deposits	2026-07-08 13:58:22.035
cmr7cmr8h000tozy90ku9q5s0	cmr7cl0hc000fozy9nbyyy76r	Deposit Submitted	Your deposit of $10 via Zappay has been submitted and is pending review.	info	t	/dashboard/deposits	2026-07-04 23:56:53.538
cmr7cncr4000vozy9kxa0rki4	cmr7cl0hc000fozy9nbyyy76r	âœ… Deposit Approved!	Your deposit of $10.00 has been approved and added to your balance.	success	t	/dashboard/deposits	2026-07-04 23:57:21.424
cmr7fmmxh000c7di6ts0k3lgs	cmr7cl0hc000fozy9nbyyy76r	Deposit Submitted	Your deposit of $10 via Zappay has been submitted and is pending review.	info	t	/dashboard/deposits	2026-07-05 01:20:46.805
cmr7fmxsc000e7di68xdsqzme	cmr7cl0hc000fozy9nbyyy76r	âœ… Deposit Approved!	Your deposit of $10.00 has been approved and added to your balance.	success	t	/dashboard/deposits	2026-07-05 01:21:00.877
cmr7gyah0000atdka142mi6y4	cmr7cl0hc000fozy9nbyyy76r	Deposit Submitted	Your deposit of $25 via Zappay has been submitted and is pending review.	info	t	/dashboard/deposits	2026-07-05 01:57:50.149
cmr7gyjk3000ctdkaj5bi12hg	cmr7cl0hc000fozy9nbyyy76r	âœ… Deposit Approved!	Your deposit of $25.00 has been approved and added to your balance.	success	t	/dashboard/deposits	2026-07-05 01:58:01.924
cmrhpfl2a00068hmhuesvnhhd	cmr69jqsu000012lh99aj857o	âœ… Withdrawal Approved!	Your withdrawal request WD-20260712-BETTWWSV for $10.00 has been approved.	success	t	/dashboard/withdrawals	2026-07-12 11:22:55.714
cmsdsmdfy00084w616q1mb7fi	cmr69jqsu000012lh99aj857o	âœ… Deposit Approved!	Your deposit of $10.00 has been approved and added to your balance.	success	t	/dashboard/deposits	2026-08-03 22:20:48.91
cmrgtziez0001s0r604p588wc	cmrgtuww2000ecyz8yx2kxdgc	âœ… Deposit Approved!	Your deposit of $25.00 has been approved and added to your balance.	success	t	/dashboard/deposits	2026-07-11 15:12:37.263
cmrcjm7h8000izv5i81oldokb	cmravwyxd001yd1fmakz8rtio	Deposit Submitted	Your deposit of $10 is being processed.	info	f	/dashboard/deposits	2026-07-08 15:11:16.124
cmrcjnx7v000pzv5i6l5ko20x	cmravwyxd001yd1fmakz8rtio	âŒ Deposit Failed	Your deposit of $10.00 was rejected. Reason: No payment received. Contact support if needed.	error	f	/dashboard/deposits	2026-07-08 15:12:36.14
cmrhq50cy0004ptpltda1wapc	cmr69jqsu000012lh99aj857o	âŒ Withdrawal Rejected	Your withdrawal request WD-20260712-40M7KEA4 for $5.00 was rejected. Reason: Incorrect details Contact support for help.	error	t	/dashboard/withdrawals	2026-07-12 11:42:41.938
cmrhq64jc001eunsxxib59y42	cmr69jqsu000012lh99aj857o	Deposit Submitted	Your deposit of $10 is being processed.	info	t	/dashboard/deposits	2026-07-12 11:43:34.009
cmrhq6etw0007ptplmpdm62e3	cmr69jqsu000012lh99aj857o	âœ… Deposit Approved!	Your deposit of $10.00 has been approved and added to your balance.	success	t	/dashboard/deposits	2026-07-12 11:43:47.086
cmrhq6ihi001gunsxl0xzb86d	cmr69jqsu000012lh99aj857o	Deposit Approved!	Your $10 Chime deposit was automatically verified and credited.	success	t	/dashboard/deposits	2026-07-12 11:43:52.086
cms2wb6qn000u6wjsgb6lc2b2	cmr69jqsu000012lh99aj857o	âŒ Withdrawal Rejected	Your withdrawal request WD-20260727-1CVIROX6 for $9.00 was rejected. Contact support for help.	error	t	/dashboard/withdrawals	2026-07-27 07:18:37.275
cms2wcmzs00126wjs1r65aahe	cmr69jqsu000012lh99aj857o	âŒ Deposit Failed	Your deposit of $10.00 was rejected. Reason: No payment received. Contact support if needed.	error	t	/dashboard/deposits	2026-07-27 07:19:45.256
cmrgsfzdw000211q00e3tc5mm	cmr69jqsu000012lh99aj857o	âŒ Deposit Failed	Your deposit of $10.00 was rejected. Reason: No payment received. Contact support if needed.	error	t	/dashboard/deposits	2026-07-11 14:29:26.948
cmrgrip18000aw7eyvs65y7h7	cmr69jqsu000012lh99aj857o	Deposit Submitted	Your deposit of $18 is being processed.	info	t	/dashboard/deposits	2026-07-11 14:03:33.884
cms3j2js20005m3grb49msj1o	cms3gns5x000530c0xul9v2ea	âœ… Deposit Approved!	Your deposit of $15.00 has been approved and added to your balance.	success	f	/dashboard/deposits	2026-07-27 17:55:45.689
cms3kewlg00044zzficsdlvb0	cmr7cl0hc000fozy9nbyyy76r	Deposit Submitted	Your deposit of $10 is being processed.	info	t	/dashboard/deposits	2026-07-27 18:33:21.796
cms3kf6iv00084zzfb8xwkri8	cmr7cl0hc000fozy9nbyyy76r	Deposit Approved!	Your $10 Chime deposit was automatically verified and credited.	success	t	/dashboard/deposits	2026-07-27 18:33:34.663
cms3jhu0p0007m3grgbedq6o8	cmr7cl0hc000fozy9nbyyy76r	âœ… Deposit Approved!	Your deposit of $10.00 has been approved and added to your balance.	success	t	/dashboard/deposits	2026-07-27 18:07:36.815
cms3j1vei001a30c0xtu2y9cj	cmr7cl0hc000fozy9nbyyy76r	Deposit Submitted	Your deposit of $10 is being processed.	info	t	/dashboard/deposits	2026-07-27 17:55:14.106
cms3j2cdx0003m3grgfea70oc	cmr7cl0hc000fozy9nbyyy76r	âœ… Deposit Approved!	Your deposit of $10.00 has been approved and added to your balance.	success	t	/dashboard/deposits	2026-07-27 17:55:34.145
cms3jjmm1001k30c05r3r062i	cmr7cl0hc000fozy9nbyyy76r	Deposit Submitted	Your deposit of $5 is being processed.	info	t	/dashboard/deposits	2026-07-27 18:09:02.521
cms53e36400164zzf3oyodmqh	cmr7cl0hc000fozy9nbyyy76r	âœ… Withdrawal Approved!	Your withdrawal request WD-20260728-BGY7ZDMW for $30.00 has been approved.	success	t	/dashboard/withdrawals	2026-07-28 20:12:22.539
cmr7aw7ew0006conqp178n9fv	cmr6b50aw0003mn9sssynf9dg	âŒ Withdrawal Rejected	Your withdrawal request WD-1004 for $10.00 was rejected. Reason: Incorrect details Contact support for help.	error	t	/dashboard/withdrawals	2026-07-04 23:08:15.104
cmsc3mbcx000a79ufp9a35y2m	cmr6b50aw0003mn9sssynf9dg	âŒ Deposit Failed	Your deposit of $10.00 was rejected. Reason: No payment received. Contact support if needed.	error	t	/dashboard/deposits	2026-08-02 17:53:09.633
cmr7awy6j000cconqenxlchdj	cmr6b50aw0003mn9sssynf9dg	âœ… Withdrawal Approved!	Your withdrawal request WD-1005 for $10.00 has been approved.	success	t	/dashboard/withdrawals	2026-07-04 23:08:49.867
cmrr1veub000k10ffsfybmoex	cmr6b50aw0003mn9sssynf9dg	Deposit Submitted	Your deposit of $10 is being processed.	info	t	/dashboard/deposits	2026-07-19 00:21:05.124
cmr7axjw2000iconqdb9ffb6b	cmr6b50aw0003mn9sssynf9dg	Deposit Submitted	Your deposit of $10 via Zappay has been submitted and is pending review.	info	t	/dashboard/deposits	2026-07-04 23:09:18.002
cmr7axpkc000kconqe7o6dfi1	cmr6b50aw0003mn9sssynf9dg	âŒ Deposit Failed	Your deposit of $10.00 was rejected. Reason: No payment received. Contact support if needed.	error	t	/dashboard/deposits	2026-07-04 23:09:25.273
cms2wchf500106wjsy773ivfj	cmr69jqsu000012lh99aj857o	Deposit Submitted	Your deposit of $10 is being processed.	info	t	/dashboard/deposits	2026-07-27 07:19:36.045
cms2w0mi100066wjsju5lv4jc	cmr69jqsu000012lh99aj857o	âŒ Deposit Failed	Your deposit of $5.00 was rejected. Reason: No payment received. Contact support if needed.	error	t	/dashboard/deposits	2026-07-27 07:10:24.48
cms2w20lm000b6wjsydr4mzrl	cmr69jqsu000012lh99aj857o	âŒ Withdrawal Rejected	Your withdrawal request WD-20260727-CLTD7M48 for $9.00 was rejected. Reason: Incorrect details Contact support for help.	error	t	/dashboard/withdrawals	2026-07-27 07:11:29.674
cms2w58ex000h6wjs3k391ays	cmr69jqsu000012lh99aj857o	âŒ Withdrawal Rejected	Your withdrawal request WD-20260727-5HB26U9N for $9.00 was rejected. Reason: Bank information invalid Contact support for help.	error	t	/dashboard/withdrawals	2026-07-27 07:13:59.769
cmrbub4xy000d91gfm0b171s6	cmr69jqsu000012lh99aj857o	âŒ Deposit Failed	Your deposit of $10.00 was rejected. Reason: No payment received. Contact support if needed.	error	t	/dashboard/deposits	2026-07-08 03:22:49.222
cmrrrta1m0004zbtxkt10h9dd	cmrqzvdm100056ihjug2ahews	Balance Added	$5.00 has been added to your wallet by admin.	success	f	\N	2026-07-19 12:27:15.61
cms3jhg2j001f30c0kjh1onvk	cmr7cl0hc000fozy9nbyyy76r	Deposit Submitted	Your deposit of $10 is being processed.	info	t	/dashboard/deposits	2026-07-27 18:07:20.731
cms3jjv5e0009m3grse0w4mye	cmr7cl0hc000fozy9nbyyy76r	âŒ Deposit Failed	Your deposit of $5.00 was rejected. Reason: No payment received. Contact support if needed.	error	t	/dashboard/deposits	2026-07-27 18:09:13.331
cms3kf3qt00064zzfsbyvsfz0	cmr7cl0hc000fozy9nbyyy76r	âœ… Deposit Approved!	Your deposit of $10.00 has been approved and added to your balance.	success	t	/dashboard/deposits	2026-07-27 18:33:31.061
cmrbub0lt000b91gfnywa4ix8	cmr69jqsu000012lh99aj857o	Deposit Submitted	Your deposit of $10 is being processed.	info	t	/dashboard/deposits	2026-07-08 03:22:43.601
cmr7kqi5n000cnggfx6mk5g8o	cmr6b50aw0003mn9sssynf9dg	Deposit Submitted	Your deposit of $10 is being processed.	info	t	/dashboard/deposits	2026-07-05 03:43:45.323
cmr7kqpo6000enggferbv4ckr	cmr6b50aw0003mn9sssynf9dg	âœ… Deposit Approved!	Your deposit of $10.00 has been approved and added to your balance.	success	t	/dashboard/deposits	2026-07-05 03:43:55.062
cmrr29vgz000c12lg6ubsr69b	cmr6b50aw0003mn9sssynf9dg	âŒ Deposit Failed	Your deposit of $10.00 was rejected. Reason: No payment received. Contact support if needed.	error	t	/dashboard/deposits	2026-07-19 00:32:19.859
cmrrrvmty0008zbtxldqygvf1	cmr6b50aw0003mn9sssynf9dg	Balance Added	$5.00 has been added to your wallet by admin.	success	t	\N	2026-07-19 12:29:05.494
cmsc3lnt7000879uf0xs8a0t2	cmr6b50aw0003mn9sssynf9dg	Deposit Submitted	Your deposit of $10 is being processed.	info	t	/dashboard/deposits	2026-08-02 17:52:39.114
cmrgrnktz000ew7ey7m4h1clr	cmr69jqsu000012lh99aj857o	âŒ Deposit Failed	Your deposit of $18.00 was rejected. Reason: No payment received. Contact support if needed.	error	t	/dashboard/deposits	2026-07-11 14:07:21.659
cmrbubt0e000i91gflo5xugmu	cmr69jqsu000012lh99aj857o	Deposit Submitted	Your deposit of $10 is being processed.	info	t	/dashboard/deposits	2026-07-08 03:23:20.414
cmrgrao3f0001pakwxztorm5r	cmr69jqsu000012lh99aj857o	âŒ Deposit Failed	Your deposit of $18.00 was rejected. Reason: No payment received. Contact support if needed.	error	t	/dashboard/deposits	2026-07-11 13:57:19.419
cmshbjrxx000uat3ajui61epw	cmrgtuww2000ecyz8yx2kxdgc	Deposit Submitted	Your deposit of $10 is being processed.	info	f	/dashboard/deposits	2026-08-06 09:33:58.965
cmshbk1xf000wat3atwqdvp6b	cmrgtuww2000ecyz8yx2kxdgc	âœ… Deposit Approved!	Your deposit of $10.00 has been approved and added to your balance.	success	f	/dashboard/deposits	2026-08-06 09:34:11.552
cmshbk3w5000yat3a3vhbykeu	cmrgtuww2000ecyz8yx2kxdgc	Deposit Approved!	Your $10 Chime deposit was automatically verified and credited.	success	f	/dashboard/deposits	2026-08-06 09:34:14.453
cmrgs4zhj0008skz96uq51dhv	cmr69jqsu000012lh99aj857o	Deposit Approved!	Your $20 Chime deposit was automatically verified and credited.	success	t	/dashboard/deposits	2026-07-11 14:20:53.864
cmrch0siu000j1uvaucsvzuoj	cmr69jqsu000012lh99aj857o	âŒ Deposit Failed	Your deposit of $10.00 was rejected. Reason: No payment received. Contact support if needed.	error	t	/dashboard/deposits	2026-07-08 13:58:37.677
cmrchqywk0006hloaew95n9y0	cmr69jqsu000012lh99aj857o	Deposit Submitted	Your deposit of $10 is being processed.	info	t	/dashboard/deposits	2026-07-08 14:18:59.06
cmrchs4o50008hloahu70e9zk	cmr69jqsu000012lh99aj857o	âŒ Deposit Failed	Your deposit of $10.00 was rejected. Reason: No payment received. Contact support if needed.	error	t	/dashboard/deposits	2026-07-08 14:19:53.189
cmrgs6jdh000dskz97hzdx1yu	cmr69jqsu000012lh99aj857o	Deposit Submitted	Your deposit of $10 is being processed.	info	t	/dashboard/deposits	2026-07-11 14:22:06.293
cmrgr6ni00004cyz85zg61n3h	cmr69jqsu000012lh99aj857o	Deposit Submitted	Your deposit of $18 is being processed.	info	t	/dashboard/deposits	2026-07-11 13:54:12.024
cmrch64ir000o1uvapftsbt21	cmr69jqsu000012lh99aj857o	Deposit Submitted	Your deposit of $10 is being processed.	info	t	/dashboard/deposits	2026-07-08 14:02:46.563
cmr7ag56i0003d41dob6fmwif	cmr6b50aw0003mn9sssynf9dg	Cashout Rejected	Your cashout of $10 was rejected.  Please contact support.	error	t	/dashboard/cashouts	2026-07-04 22:55:45.786
cmr7alz8100038jwrao109ypx	cmr6b50aw0003mn9sssynf9dg	Cashout Rejected	Your cashout of $10 was rejected.  Please contact support.	error	t	/dashboard/cashouts	2026-07-04 23:00:18.001
cmr7apbsi0002108872yhpbtx	cmr6b50aw0003mn9sssynf9dg	âŒ Withdrawal Rejected	Your withdrawal request WD-1003 for $10.00 was rejected. Reason: Duplicate request Please contact support if you have questions.	error	t	/dashboard/withdrawals	2026-07-04 23:02:54.258
cmrr1vtsl000m10ffrd9wgqeh	cmr6b50aw0003mn9sssynf9dg	âŒ Deposit Failed	Your deposit of $10.00 was rejected. Reason: No payment received. Contact support if needed.	error	t	/dashboard/deposits	2026-07-19 00:21:24.501
cmrcjmx3v000nzv5io0ccie7s	cmr6b50aw0003mn9sssynf9dg	Deposit Submitted	Your deposit of $10 is being processed.	info	t	/dashboard/deposits	2026-07-08 15:11:49.339
cmrr29h1z000a12lgyv87jgpw	cmr6b50aw0003mn9sssynf9dg	Deposit Submitted	Your deposit of $10 is being processed.	info	t	/dashboard/deposits	2026-07-19 00:32:01.175
cmrrqpww1000eypvwlxej3w6s	cmr6b50aw0003mn9sssynf9dg	âœ… Withdrawal Approved!	Your withdrawal request WD-20260719-446LMAS5 for $5.00 has been approved.	success	t	/dashboard/withdrawals	2026-07-19 11:56:38.704
cmrch6c0f000q1uvagb85yo7t	cmr69jqsu000012lh99aj857o	âŒ Deposit Failed	Your deposit of $10.00 was rejected. Reason: No payment received. Contact support if needed.	error	t	/dashboard/deposits	2026-07-08 14:02:56.271
cmrcg1wvy000a1uvacymz3h3v	cmr69jqsu000012lh99aj857o	Deposit Submitted	Your deposit of $10 is being processed.	info	t	/dashboard/deposits	2026-07-08 13:31:30.43
cmrcg2qrs000c1uvaovs5l8yg	cmr69jqsu000012lh99aj857o	âŒ Deposit Failed	Your deposit of $10.00 was rejected. Reason: No payment received. Contact support if needed.	error	t	/dashboard/deposits	2026-07-08 13:32:09.16
cmrbu46ss000491gfu6ctuj10	cmr69jqsu000012lh99aj857o	Deposit Submitted	Your deposit of $10 is being processed.	info	t	/dashboard/deposits	2026-07-08 03:17:25.036
cmrbu4jh1000691gf8ztquk7q	cmr69jqsu000012lh99aj857o	âŒ Deposit Failed	Your deposit of $10.00 was rejected. Reason: No payment received. Contact support if needed.	error	t	/dashboard/deposits	2026-07-08 03:17:41.461
cmrgrjq60000cw7eyy41655js	cmr69jqsu000012lh99aj857o	Deposit Approved!	Your $18 Chime deposit was automatically verified and credited.	success	t	/dashboard/deposits	2026-07-11 14:04:22.008
cmrgs4l7j0004skz9atj29auv	cmr69jqsu000012lh99aj857o	Deposit Submitted	Your deposit of $20 is being processed.	info	t	/dashboard/deposits	2026-07-11 14:20:35.359
cmrgs4vl40006skz9678j06rm	cmr69jqsu000012lh99aj857o	âœ… Deposit Approved!	Your deposit of $20.00 has been approved and added to your balance.	success	t	/dashboard/deposits	2026-07-11 14:20:48.734
cmsdo5ihb0006kutg8yio67jw	cmr69jqsu000012lh99aj857o	Deposit Submitted	Your deposit of $10 is being processed.	info	t	/dashboard/deposits	2026-08-03 20:15:43.823
cmrgrgihw0004w7ey6luy0qeq	cmr69jqsu000012lh99aj857o	Deposit Submitted	Your deposit of $18 is being processed.	info	t	/dashboard/deposits	2026-07-11 14:01:52.1
cmrbubvsb000k91gfdm0a1osm	cmr69jqsu000012lh99aj857o	âŒ Deposit Failed	Your deposit of $10.00 was rejected. Reason: No payment received. Contact support if needed.	error	t	/dashboard/deposits	2026-07-08 03:23:24.011
cmrbvfl3e00083y6su7inpkjo	cmr69jqsu000012lh99aj857o	Deposit Submitted	Your deposit of $10 is being processed.	info	t	/dashboard/deposits	2026-07-08 03:54:16.394
cmrbvfxru000a3y6sf87kbkmz	cmr69jqsu000012lh99aj857o	âŒ Deposit Failed	Your deposit of $10.00 was rejected. Reason: No payment received. Contact support if needed.	error	t	/dashboard/deposits	2026-07-08 03:54:32.826
cmsdo5v5o0008kutgkp1s77zu	cmr69jqsu000012lh99aj857o	âŒ Deposit Failed	Your deposit of $10.00 was rejected. Reason: No payment received. Contact support if needed.	error	t	/dashboard/deposits	2026-08-03 20:16:00.252
cmrqz7dts000a11m662lw5c6h	cmr69jqsu000012lh99aj857o	âŒ Deposit Failed	Your deposit of $10.00 was rejected. Reason: No payment received. Contact support if needed.	error	t	/dashboard/deposits	2026-07-18 23:06:24.833
\.


--
-- Data for Name: PaymentMethod; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."PaymentMethod" (id, name, code, type, "isActive", "minAmount", "maxAmount", "feePercent", "iconUrl", instructions, fields, "apiConfig", "cashoutEnabled", "createdAt", "updatedAt") FROM stdin;
cmsc371jd000012cu1qx6weh6	Cash App	cashapp	bank	t	10	10000	0	https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Square_Cash_app_logo.svg/1200px-Square_Cash_app_logo.svg.png	Send to our $Cashtag. Include your username in the note.	"[{\\"name\\":\\"accountInfo\\",\\"label\\":\\"$Cashtag\\",\\"type\\":\\"text\\",\\"required\\":true,\\"placeholder\\":\\"$yourcashtag\\"}]"	\N	t	2026-08-02 17:41:17.064	2026-08-02 17:41:17.064
cmsc372yh000112cucdnr5m7p	Chime	chime	bank	t	10	10000	0	https://upload.wikimedia.org/wikipedia/commons/thumb/0/0b/Chime_company_logo.svg/1200px-Chime_company_logo.svg.png	Enter your Chime email or phone number for receiving funds.	"[{\\"name\\":\\"accountInfo\\",\\"label\\":\\"Chime Email or Phone\\",\\"type\\":\\"text\\",\\"required\\":true,\\"placeholder\\":\\"email@example.com or +1...\\"}]"	\N	t	2026-08-02 17:41:18.905	2026-08-02 17:41:18.905
cmsc374a5000212cul2pdanbs	Crypto (USDT / BTC)	crypto	crypto	t	10	50000	0		Provide your crypto wallet address. We support USDT (TRC20) and Bitcoin (BTC).	"[{\\"name\\":\\"coin\\",\\"label\\":\\"Select Coin\\",\\"type\\":\\"select\\",\\"required\\":true,\\"options\\":[\\"USDT (TRC20)\\",\\"Bitcoin (BTC)\\"]},{\\"name\\":\\"accountInfo\\",\\"label\\":\\"Wallet Address\\",\\"type\\":\\"text\\",\\"required\\":true,\\"placeholder\\":\\"Your wallet address...\\"}]"	\N	t	2026-08-02 17:41:20.621	2026-08-02 17:41:20.621
cmsc375ml000312cuzzblvng8	PayPal	paypal	bank	t	10	10000	0	https://upload.wikimedia.org/wikipedia/commons/b/b5/PayPal.svg	Send to our PayPal email. Include your username in the note.	"[{\\"name\\":\\"accountInfo\\",\\"label\\":\\"Your PayPal Email\\",\\"type\\":\\"text\\",\\"required\\":true,\\"placeholder\\":\\"you@email.com\\"}]"	\N	t	2026-08-02 17:41:22.366	2026-08-02 17:41:22.366
cmsc37733000412cutn5rjv9u	Zappay	zappay	bank	t	1	10000	0		Deposit via Zappay	"[{\\"name\\":\\"accountInfo\\",\\"label\\":\\"Zappay Profile Name\\",\\"type\\":\\"text\\",\\"required\\":true,\\"placeholder\\":\\"Your Profile Name\\"}]"	\N	t	2026-08-02 17:41:24.255	2026-08-02 17:41:24.255
\.


--
-- Data for Name: PaymentWebhook; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."PaymentWebhook" (id, provider, payload, status, error, "createdAt") FROM stdin;
\.


--
-- Data for Name: Provider; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Provider" (id, name, "apiBaseUrl", "agentId", "secretKey", status, logo, "requestTimeout", "retryCount", endpoints, "createdAt", "updatedAt") FROM stdin;
cmr5fjihw000vqs55y8i87kv5	Vegas Sweeps	https://apius.lasvegassweeps.com	37220	6cb4d934a7e61d9921037c177f63b32f	t	\N	5000	3	\N	2026-07-04 05:57:56.253	2026-07-04 23:51:52.779
cmr69xaxy0000yfqf0lk4ujmo	Game Vault	https://apius.gamevault999.com	178114	355e3ffc2e43411a0f7d42942ed5f102	t	\N	5000	3	{}	2026-07-04 05:53:20.612	2026-07-04 23:54:12.816
cmr7lwt20002rnggfbn8d7kil	Juwa	https://external.juwa777.com	122030	91f216fe9cd5803cb2f52bb78cbe5305	t	\N	5000	3	{}	2026-07-05 04:16:38.81	2026-07-05 04:37:38.488
cmr5ffgpe000mqs55ym8xwjyg	Juwa 2.0	https://apiinterface.juwa2.xin	944	324c20c81d57654d9a32fb42c8f377df	t	\N	5000	3	\N	2026-07-04 05:57:55.615	2026-07-05 04:41:06.673
cmsfvgxvr00087y6fy1hmp5x7	Orion Star	https://orionstars.vip:8033/ws/service.ashx	holaosgm512	Holaosgm512@#	t	\N	5000	3	{}	2026-08-05 09:16:06.663	2026-08-06 10:46:20.235
\.


--
-- Data for Name: ProviderBalanceHistory; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ProviderBalanceHistory" (id, "providerId", balance, "recordedAt") FROM stdin;
\.


--
-- Data for Name: ProviderLog; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ProviderLog" (id, "providerId", "userId", endpoint, request, response, status, "errorMessage", "ipAddress", "createdAt") FROM stdin;
cmr6gayp3001gxv9xic7cthc3	cmr69xaxy0000yfqf0lk4ujmo	\N	/api/external/getUserID	{"token": "926fdd0944d1cec679f86cac7a364e8e", "agent_id": "178114", "timestamp": "1783174915443", "account_name": "POnNKZqhdjtKemXS"}	{"msg": "Token expired", "code": 4, "data": [], "count": 0}	4	Token Expired	\N	2026-07-04 08:51:55.623
cmr6gazjy001ixv9xqucso5ga	cmr69xaxy0000yfqf0lk4ujmo	\N	/api/external/getUserID	{"token": "bb4ab32fe0f6b667853695cdf29c8174", "agent_id": "178114", "timestamp": "1783174916", "account_name": "POnNKZqhdjtKemXS"}	{"msg": "Invalid user ID", "code": 8, "data": [], "count": 0}	8	Invalid User ID	\N	2026-07-04 08:51:56.735
cmr7cgnrl0003ozy9m7tdwj45	cmr5fjihw000vqs55y8i87kv5	\N	/api/external/agentBalance	{"token": "9fcb2781b0f9071fc3384ecdfa177f33", "agent_id": "37220", "timestamp": "1783228928724"}	{"msg": "Token expired", "code": 4, "data": [], "count": 0}	4	Token Expired	\N	2026-07-04 23:52:09.106
cmr7cgomc0005ozy95juhjyoa	cmr5fjihw000vqs55y8i87kv5	\N	/api/external/agentBalance	{"token": "24776bfdb25243c7168b22c5ead7942e", "agent_id": "37220", "timestamp": "1783228930"}	{"msg": "Success", "code": 0, "data": {"agent_balance": "1336.14"}, "count": 0}	200	\N	\N	2026-07-04 23:52:10.213
cmr7ciwmd0007ozy9gt1dwegx	cmr69xaxy0000yfqf0lk4ujmo	\N	/api/external/agentBalance	{"token": "fa724836e16992ac0834e1608484ce44", "agent_id": "178114", "timestamp": "1783229033679"}	{"msg": "Token expired", "code": 4, "data": [], "count": 0}	4	Token Expired	\N	2026-07-04 23:53:53.894
cmr7cixh80009ozy9efs1lhye	cmr69xaxy0000yfqf0lk4ujmo	\N	/api/external/agentBalance	{"token": "02d0959eb54731d946cfedb5a22bc075", "agent_id": "178114", "timestamp": "1783229034"}	{"msg": "Success", "code": 0, "data": {"agent_balance": "1000"}, "count": 0}	200	\N	\N	2026-07-04 23:53:55.004
cmr7ciyv7000bozy905jyuj0f	cmr5ffgpe000mqs55ym8xwjyg	\N	/api/external/agentBalance	{"token": "8809e7beb63d148fac85f721fa3d6a5c", "agent_id": "944", "timestamp": "1783229036536"}	{"msg": "unKnownErrorCode", "code": 4, "data": [], "count": 0}	4	Token Expired	\N	2026-07-04 23:53:56.803
cmr7cizpc000dozy9jjm0ws5m	cmr5ffgpe000mqs55ym8xwjyg	\N	/api/external/agentBalance	{"token": "b8651bb3d2c1701da9e16c90c549729e", "agent_id": "944", "timestamp": "1783229037"}	{"msg": "unKnownErrorCode", "code": 0, "data": {"agent_balance": "2399.8"}, "count": 0}	200	\N	\N	2026-07-04 23:53:57.889
cmr7cm6bt000kozy9hmhe2ki7	cmr69xaxy0000yfqf0lk4ujmo	\N	/api/external/addUser	{"token": "6fe72a346beeec21d84f945511a96b74", "account": "Laurelanna", "agent_id": "178114", "login_pwd": "Default123!", "timestamp": "1783229183"}	{"msg": "Success", "code": 0, "data": {"user_id": "15277896", "account_name": "laurelanna"}, "count": 0}	200	\N	\N	2026-07-04 23:56:26.442
cmr7cmc15000oozy9diz3du8h	cmr69xaxy0000yfqf0lk4ujmo	15277896	/api/external/userBalance	{"token": "8287c8cbe2db0a46f91244e6708502a4", "user_id": "15277896", "agent_id": "178114", "timestamp": "1783229193"}	{"msg": "Success", "code": 0, "data": {"user_balance": "0"}, "count": 0}	200	\N	\N	2026-07-04 23:56:33.833
cmr7cnt1q000xozy9j4jvdpqo	cmr69xaxy0000yfqf0lk4ujmo	15277896	/api/external/userBalance	{"token": "f5f39060b7b007708c924e05849088fe", "user_id": "15277896", "agent_id": "178114", "timestamp": "1783229262"}	{"msg": "Success", "code": 0, "data": {"user_balance": "0"}, "count": 0}	200	\N	\N	2026-07-04 23:57:42.542
cmr7co4cu000zozy90dkhk65p	cmr69xaxy0000yfqf0lk4ujmo	15277896	/api/external/playerOffline	{"token": "8d6580ac8cfae1c712a12d90fa82c1fc", "user_id": "15277896", "agent_id": "178114", "timestamp": "1783229277"}	{"msg": "Success", "code": 0, "data": null, "count": 0}	200	\N	\N	2026-07-04 23:57:57.198
cmr7cobqp0013ozy9kie7ldpw	cmr69xaxy0000yfqf0lk4ujmo	15277896	/api/external/recharge	{"token": "429c2716d8e33621a6b57acc414d4b99", "amount": "6.5", "user_id": "15277896", "agent_id": "178114", "order_id": "TX_1783229282432_3tube", "timestamp": "1783229286"}	{"msg": "Success", "code": 0, "data": {"amount": "6.5", "pay_order_id": "TX_1783229282432_3tube", "user_balance": "6.5", "agent_balance": "993.5", "transaction_id": "1783229286916901", "transaction_time": "1783229286"}, "count": 0}	200	\N	\N	2026-07-04 23:58:06.769
cmr7coid70017ozy9kfq4kfzl	cmr69xaxy0000yfqf0lk4ujmo	15277896	/api/external/userBalance	{"token": "7bbd647a35847d384a8ef29218d3cda2", "user_id": "15277896", "agent_id": "178114", "timestamp": "1783229295"}	{"msg": "Success", "code": 0, "data": {"user_balance": "6.5"}, "count": 0}	200	\N	\N	2026-07-04 23:58:15.355
cmr7cqgzq0019ozy9u9aowocl	cmr69xaxy0000yfqf0lk4ujmo	15277896	/api/external/userBalance	{"token": "9dfc08e089dfa0055343d3006b1c6007", "user_id": "15277896", "agent_id": "178114", "timestamp": "1783229386"}	{"msg": "Success", "code": 0, "data": {"user_balance": "0"}, "count": 0}	200	\N	\N	2026-07-04 23:59:46.886
cmr7csl4i001bozy986ty76fe	cmr69xaxy0000yfqf0lk4ujmo	15277896	/api/external/userBalance	{"token": "8c4ffe7c3c279752814d58c90a1e3874", "user_id": "15277896", "agent_id": "178114", "timestamp": "1783229485"}	{"msg": "Success", "code": 0, "data": {"user_balance": "0"}, "count": 0}	200	\N	\N	2026-07-05 00:01:25.554
cmr7csugy001dozy9vch36w8j	cmr69xaxy0000yfqf0lk4ujmo	15277896	/api/external/userBalance	{"token": "92ae63c92ff4c7ff8bc3dd428ae3225c", "user_id": "15277896", "agent_id": "178114", "timestamp": "1783229497"}	{"msg": "Success", "code": 0, "data": {"user_balance": "0"}, "count": 0}	200	\N	\N	2026-07-05 00:01:37.666
cmr7cta5v001fozy92pra5k1q	cmr69xaxy0000yfqf0lk4ujmo	15277896	/api/external/playerOffline	{"token": "aab009386ed3d3fda02f47aeb22d2874", "user_id": "15277896", "agent_id": "178114", "timestamp": "1783229517"}	{"msg": "Success", "code": 0, "data": null, "count": 0}	200	\N	\N	2026-07-05 00:01:58.003
cmr7cts17001jozy9sbqmiri5	cmr69xaxy0000yfqf0lk4ujmo	15277896	/api/external/playerOffline	{"token": "51fbd81cd3a4ff13fc908cb469c5f0bd", "user_id": "15277896", "agent_id": "178114", "timestamp": "1783229541"}	{"msg": "Success", "code": 0, "data": null, "count": 0}	200	\N	\N	2026-07-05 00:02:21.163
cmr7cual2001nozy90xmnmxkb	cmr69xaxy0000yfqf0lk4ujmo	15277896	/api/external/playerOffline	{"token": "41ee587237214de94490b87ebc2191d9", "user_id": "15277896", "agent_id": "178114", "timestamp": "1783229565"}	{"msg": "Success", "code": 0, "data": null, "count": 0}	200	\N	\N	2026-07-05 00:02:45.207
cmr7cwntp001rozy9itngs69w	cmr69xaxy0000yfqf0lk4ujmo	15277896	/api/external/userBalance	{"token": "6016f9bb5ec2db1eab9087b7552f2ee7", "user_id": "15277896", "agent_id": "178114", "timestamp": "1783229675"}	{"msg": "Success", "code": 0, "data": {"user_balance": "0"}, "count": 0}	200	\N	\N	2026-07-05 00:04:35.677
cmr7df9n60001uv754couab1p	cmr69xaxy0000yfqf0lk4ujmo	15277896	/api/external/userBalance	{"token": "6bb54b5202af1f90f468a986a064f996", "user_id": "15277896", "agent_id": "178114", "timestamp": "1783230542086"}	{"msg": "Token expired", "code": 4, "data": [], "count": 0}	4	Token Expired	\N	2026-07-05 00:19:03.762
cmr7dfagk0003uv75i1yx0744	cmr69xaxy0000yfqf0lk4ujmo	15277896	/api/external/userBalance	{"token": "0e982d46a9e5211c8675a4b91b17554b", "user_id": "15277896", "agent_id": "178114", "timestamp": "1783230544"}	{"msg": "Success", "code": 0, "data": {"user_balance": "0"}, "count": 0}	200	\N	\N	2026-07-05 00:19:04.82
cmr7dffar0005uv75823918q9	cmr69xaxy0000yfqf0lk4ujmo	15277896	/api/external/userBalance	{"token": "300da467c7dc5ad23402d452f577b08c", "user_id": "15277896", "agent_id": "178114", "timestamp": "1783230550"}	{"msg": "Success", "code": 0, "data": {"user_balance": "0"}, "count": 0}	200	\N	\N	2026-07-05 00:19:10.54
cmr7dfmi70007uv754atm00tn	cmr69xaxy0000yfqf0lk4ujmo	15277896	/api/external/userBalance	{"token": "276966a99170e33874a989003d5c93b0", "user_id": "15277896", "agent_id": "178114", "timestamp": "1783230559"}	{"msg": "Success", "code": 0, "data": {"user_balance": "0"}, "count": 0}	200	\N	\N	2026-07-05 00:19:19.434
cmr7dfxb7000buv751jnskr0n	cmr69xaxy0000yfqf0lk4ujmo	15277896	/api/external/userBalance	{"token": "340d39ed5fd343adfd9b42c550c26944", "user_id": "15277896", "agent_id": "178114", "timestamp": "1783230572"}	{"msg": "Success", "code": 0, "data": {"user_balance": "0"}, "count": 0}	200	\N	\N	2026-07-05 00:19:32.412
cmr7dg4rd000duv75mrnu61w8	cmr69xaxy0000yfqf0lk4ujmo	15277896	/api/external/userBalance	{"token": "a046b4b6ee5b31ed0c2d4c4660e962f9", "user_id": "15277896", "agent_id": "178114", "timestamp": "1783230583"}	{"msg": "Success", "code": 0, "data": {"user_balance": "0"}, "count": 0}	200	\N	\N	2026-07-05 00:19:44.089
cmr7dg95s000fuv75q479zx9i	cmr69xaxy0000yfqf0lk4ujmo	15277896	/api/external/userBalance	{"token": "1c2928f86b31489db23960972e4453e4", "user_id": "15277896", "agent_id": "178114", "timestamp": "1783230589"}	{"msg": "Success", "code": 0, "data": {"user_balance": "0"}, "count": 0}	200	\N	\N	2026-07-05 00:19:49.792
cmr7dgly9000huv75iupjuv53	cmr69xaxy0000yfqf0lk4ujmo	15277896	/api/external/userBalance	{"token": "3baeb098df3d793a9f38d7fe854cb2f3", "user_id": "15277896", "agent_id": "178114", "timestamp": "1783230606"}	{"msg": "Success", "code": 0, "data": {"user_balance": "0"}, "count": 0}	200	\N	\N	2026-07-05 00:20:06.369
cmr7dl0l1000juv75d3fb0ymf	cmr69xaxy0000yfqf0lk4ujmo	15277896	/api/external/userBalance	{"token": "bdb32c40f19033c7d387f4ee96035957", "user_id": "15277896", "agent_id": "178114", "timestamp": "1783230811"}	{"msg": "Success", "code": 0, "data": {"user_balance": "0"}, "count": 0}	200	\N	\N	2026-07-05 00:23:31.957
cmr7dl7mq000luv75nref40cw	cmr69xaxy0000yfqf0lk4ujmo	15277896	/api/external/playerOffline	{"token": "74a1f2c7063f75f4e264108fad69677f", "user_id": "15277896", "agent_id": "178114", "timestamp": "1783230820"}	{"msg": "Success", "code": 0, "data": null, "count": 0}	200	\N	\N	2026-07-05 00:23:41.09
cmr7dleow000puv754s4aa827	cmr69xaxy0000yfqf0lk4ujmo	15277896	/api/external/recharge	{"token": "e61a3e11cf942dcda63356c6bf96adad", "amount": "6.5", "user_id": "15277896", "agent_id": "178114", "order_id": "TX_1783230826172_l8s0e", "timestamp": "1783230830"}	{"msg": "Success", "code": 0, "data": {"amount": "6.5", "pay_order_id": "TX_1783230826172_l8s0e", "user_balance": "6.5", "agent_balance": "993.5", "transaction_id": "1783230830917222", "transaction_time": "1783230830"}, "count": 0}	200	\N	\N	2026-07-05 00:23:50.24
cmr7dll3y000tuv75ak16qh56	cmr69xaxy0000yfqf0lk4ujmo	15277896	/api/external/userBalance	{"token": "51f2f533f58d4ffad078b42c0f2ac4bc", "user_id": "15277896", "agent_id": "178114", "timestamp": "1783230838"}	{"msg": "Success", "code": 0, "data": {"user_balance": "6.5"}, "count": 0}	200	\N	\N	2026-07-05 00:23:58.559
cmr7dnxyn000vuv75q6v39k7l	cmr69xaxy0000yfqf0lk4ujmo	15277896	/api/external/userBalance	{"token": "5beae3e7a1633e52ee25fe96e9d3af36", "user_id": "15277896", "agent_id": "178114", "timestamp": "1783230948"}	{"msg": "Success", "code": 0, "data": {"user_balance": "0"}, "count": 0}	200	\N	\N	2026-07-05 00:25:48.527
cmr7dq8yp0001wf3uczhegr1r	cmr69xaxy0000yfqf0lk4ujmo	15277896	/api/external/userBalance	{"token": "b3a465b0a7f5759b8efc3f4b3ce33385", "user_id": "15277896", "agent_id": "178114", "timestamp": "1783231055407"}	{"msg": "Token expired", "code": 4, "data": [], "count": 0}	4	Token Expired	\N	2026-07-05 00:27:35.544
cmr7dq9sx0003wf3ucs98zr6p	cmr69xaxy0000yfqf0lk4ujmo	15277896	/api/external/userBalance	{"token": "c5069fae2d35ba3b0f32f362075bbb0c", "user_id": "15277896", "agent_id": "178114", "timestamp": "1783231057"}	{"msg": "Success", "code": 0, "data": {"user_balance": "0"}, "count": 0}	200	\N	\N	2026-07-05 00:27:37.185
cmr7dqehf0005wf3u8orf0bjv	cmr69xaxy0000yfqf0lk4ujmo	15277896	/api/external/userBalance	{"token": "d583c962b4ee1c9851829ba6100492c0", "user_id": "15277896", "agent_id": "178114", "timestamp": "1783231062"}	{"msg": "Success", "code": 0, "data": {"user_balance": "0"}, "count": 0}	200	\N	\N	2026-07-05 00:27:43.05
cmr7dqwn60007wf3uz8v1kwgm	cmr69xaxy0000yfqf0lk4ujmo	15277896	/api/external/userBalance	{"token": "efc2ec62cd305bfb519d8b95a4f8fa80", "user_id": "15277896", "agent_id": "178114", "timestamp": "1783231086"}	{"msg": "Success", "code": 0, "data": {"user_balance": "0"}, "count": 0}	200	\N	\N	2026-07-05 00:28:06.578
cmr7dry14000bwf3ufmu6p6n2	cmr69xaxy0000yfqf0lk4ujmo	15277896	/api/external/userBalance	{"token": "8b31a61dcc3750439dc813d1dbde03e7", "user_id": "15277896", "agent_id": "178114", "timestamp": "1783231135"}	{"msg": "Success", "code": 0, "data": {"user_balance": "0"}, "count": 0}	200	\N	\N	2026-07-05 00:28:55.241
cmr7ds2op000dwf3u2ii4p5hs	cmr69xaxy0000yfqf0lk4ujmo	15277896	/api/external/userBalance	{"token": "6835ff8591112f806acfb51604f9879c", "user_id": "15277896", "agent_id": "178114", "timestamp": "1783231141"}	{"msg": "Success", "code": 0, "data": {"user_balance": "0"}, "count": 0}	200	\N	\N	2026-07-05 00:29:01.274
cmr7dsbcz000fwf3uuyghjjvz	cmr69xaxy0000yfqf0lk4ujmo	15277896	/api/external/userBalance	{"token": "8ab6b9844509f6ecc14d0b2323ce9467", "user_id": "15277896", "agent_id": "178114", "timestamp": "1783231151"}	{"msg": "Success", "code": 0, "data": {"user_balance": "0"}, "count": 0}	200	\N	\N	2026-07-05 00:29:11.621
cmr7dsezy000hwf3u0w6w9gjm	cmr69xaxy0000yfqf0lk4ujmo	15277896	/api/external/userBalance	{"token": "e0ed5e18f1e6c01bf5fcb7592c01895d", "user_id": "15277896", "agent_id": "178114", "timestamp": "1783231157"}	{"msg": "Success", "code": 0, "data": {"user_balance": "0"}, "count": 0}	200	\N	\N	2026-07-05 00:29:17.23
cmr7dsjj8000jwf3ubw4wzjai	cmr69xaxy0000yfqf0lk4ujmo	15277896	/api/external/userBalance	{"token": "97ce29cf490527aa408df05f4595d52a", "user_id": "15277896", "agent_id": "178114", "timestamp": "1783231162"}	{"msg": "Success", "code": 0, "data": {"user_balance": "0"}, "count": 0}	200	\N	\N	2026-07-05 00:29:23.108
cmrgtdopm0005kn7xjx6cz34i	cmr69xaxy0000yfqf0lk4ujmo	15290343	/api/external/userBalance	{"user_id": "15290343"}	"read ECONNRESET"	500	read ECONNRESET	\N	2026-07-11 14:55:39.418
cmr7dssqu000lwf3utdyar5qa	cmr69xaxy0000yfqf0lk4ujmo	15277896	/api/external/userBalance	{"token": "4ffc7cb9ed7abbcd7ef4502b6838a03c", "user_id": "15277896", "agent_id": "178114", "timestamp": "1783231174"}	{"msg": "Success", "code": 0, "data": {"user_balance": "0"}, "count": 0}	200	\N	\N	2026-07-05 00:29:35.046
cmr7dsx77000nwf3udi5ijjhv	cmr69xaxy0000yfqf0lk4ujmo	15277896	/api/external/userBalance	{"token": "612ad60328922cb4429ac5bfb8e08d1e", "user_id": "15277896", "agent_id": "178114", "timestamp": "1783231180"}	{"msg": "Success", "code": 0, "data": {"user_balance": "0"}, "count": 0}	200	\N	\N	2026-07-05 00:29:40.819
cmr7dtwui000pwf3udwughte8	cmr69xaxy0000yfqf0lk4ujmo	15277896	/api/external/userBalance	{"token": "5cd9fc710b4fd1df1d4a8c38ad553c94", "user_id": "15277896", "agent_id": "178114", "timestamp": "1783231226"}	{"msg": "Success", "code": 0, "data": {"user_balance": "0"}, "count": 0}	200	\N	\N	2026-07-05 00:30:27.018
cmr7dvqs3000rwf3ujjjpezsa	cmr69xaxy0000yfqf0lk4ujmo	15277896	/api/external/userBalance	{"token": "e137de6bf577cdea970de204f819c16e", "user_id": "15277896", "agent_id": "178114", "timestamp": "1783231312"}	{"msg": "Success", "code": 0, "data": {"user_balance": "0"}, "count": 0}	200	\N	\N	2026-07-05 00:31:52.467
cmr7e3orp00012omkd6v5sgn4	cmr69xaxy0000yfqf0lk4ujmo	15277896	/api/external/userBalance	{"token": "65901487737e40e4e986589ef188f4b3", "user_id": "15277896", "agent_id": "178114", "timestamp": "1783231682914"}	{"msg": "Token expired", "code": 4, "data": [], "count": 0}	4	Token Expired	\N	2026-07-05 00:38:03.11
cmr7e3pml00032omk9kspah5e	cmr69xaxy0000yfqf0lk4ujmo	15277896	/api/external/userBalance	{"token": "05bb972d7b171209433b2d3d98a0e58f", "user_id": "15277896", "agent_id": "178114", "timestamp": "1783231684"}	{"msg": "Success", "code": 0, "data": {"user_balance": "0"}, "count": 0}	200	\N	\N	2026-07-05 00:38:04.221
cmr7e43is00052omk0gbr8oh8	cmr69xaxy0000yfqf0lk4ujmo	15277896	/api/external/resetPassword	{"token": "d18e64783599b087ac9b552a16a14526", "user_id": "15277896", "agent_id": "178114", "login_pwd": "NxS_dd7bf3e2", "timestamp": "1783231702"}	{"msg": "Success", "code": 0, "data": null, "count": 0}	200	\N	\N	2026-07-05 00:38:22.229
cmr7e4fbe00072omknti74wcx	cmr69xaxy0000yfqf0lk4ujmo	15277896	/api/external/userBalance	{"token": "98c7f230aba6ce86ba4d578a48176953", "user_id": "15277896", "agent_id": "178114", "timestamp": "1783231717"}	{"msg": "Success", "code": 0, "data": {"user_balance": "0"}, "count": 0}	200	\N	\N	2026-07-05 00:38:37.515
cmr7efpye00092omk9ftan56g	cmr69xaxy0000yfqf0lk4ujmo	15277896	/api/external/userBalance	{"token": "02ec92494b684d2af50a5c8923983adc", "user_id": "15277896", "agent_id": "178114", "timestamp": "1783232244"}	{"msg": "Success", "code": 0, "data": {"user_balance": "0"}, "count": 0}	200	\N	\N	2026-07-05 00:47:24.518
cmr7ffz4w0001ml1m9m13kj0r	cmr69xaxy0000yfqf0lk4ujmo	15277896	/api/external/userBalance	{"token": "1b8a712ffe5deb20b6820532f3771929", "user_id": "15277896", "agent_id": "178114", "timestamp": "1783233935837"}	{"msg": "Token expired", "code": 4, "data": [], "count": 0}	4	Token Expired	\N	2026-07-05 01:15:36.032
cmr7fg00a0003ml1mmzb1oygh	cmr69xaxy0000yfqf0lk4ujmo	15277896	/api/external/userBalance	{"token": "f44b1a7a054df3cd4c3c19f10614b74e", "user_id": "15277896", "agent_id": "178114", "timestamp": "1783233937"}	{"msg": "Success", "code": 0, "data": {"user_balance": "0"}, "count": 0}	200	\N	\N	2026-07-05 01:15:37.163
cmr7fg4qr0005ml1mdje6qhox	cmr69xaxy0000yfqf0lk4ujmo	15277896	/api/external/userBalance	{"token": "988d13348674abddd031686854cbdf0b", "user_id": "15277896", "agent_id": "178114", "timestamp": "1783233943"}	{"msg": "Success", "code": 0, "data": {"user_balance": "0"}, "count": 0}	200	\N	\N	2026-07-05 01:15:43.299
cmr7flqd900017di6p5urg5ib	cmr69xaxy0000yfqf0lk4ujmo	15277896	/api/external/userBalance	{"token": "8f3c3c0ef013448c4e70527e8f361a27", "user_id": "15277896", "agent_id": "178114", "timestamp": "1783234204467"}	{"msg": "Token expired", "code": 4, "data": [], "count": 0}	4	Token Expired	\N	2026-07-05 01:20:04.605
cmr7flr6o00037di6b78tooha	cmr69xaxy0000yfqf0lk4ujmo	15277896	/api/external/userBalance	{"token": "8c408226d044b2083b309bf59f0acbd1", "user_id": "15277896", "agent_id": "178114", "timestamp": "1783234205"}	{"msg": "Success", "code": 0, "data": {"user_balance": "0"}, "count": 0}	200	\N	\N	2026-07-05 01:20:05.664
cmr7flv9r00057di61q0l5hr5	cmr69xaxy0000yfqf0lk4ujmo	15277896	/api/external/userBalance	{"token": "9b5968405122e247590ab6f4e3a74acc", "user_id": "15277896", "agent_id": "178114", "timestamp": "1783234210"}	{"msg": "Success", "code": 0, "data": {"user_balance": "0"}, "count": 0}	200	\N	\N	2026-07-05 01:20:10.959
cmr7fm2o700077di6q9w3k1tp	cmr69xaxy0000yfqf0lk4ujmo	15277896	/api/external/userBalance	{"token": "5837e4f879513fbb42e13d33f31be68c", "user_id": "15277896", "agent_id": "178114", "timestamp": "1783234220"}	{"msg": "Success", "code": 0, "data": {"user_balance": "0"}, "count": 0}	200	\N	\N	2026-07-05 01:20:20.552
cmr7fnc48000g7di64lvtw5jl	cmr69xaxy0000yfqf0lk4ujmo	15277896	/api/external/userBalance	{"token": "c265713b211d446ef42bb15206c589bb", "user_id": "15277896", "agent_id": "178114", "timestamp": "1783234279"}	{"msg": "Success", "code": 0, "data": {"user_balance": "0"}, "count": 0}	200	\N	\N	2026-07-05 01:21:19.448
cmr7fng0x000i7di6lup49vbu	cmr69xaxy0000yfqf0lk4ujmo	15277896	/api/external/userBalance	{"token": "2ef3fe8393a6738e388df3f411c82268", "user_id": "15277896", "agent_id": "178114", "timestamp": "1783234284"}	{"msg": "Success", "code": 0, "data": {"user_balance": "0"}, "count": 0}	200	\N	\N	2026-07-05 01:21:24.513
cmr7fnkb9000k7di6nlf2fjg9	cmr69xaxy0000yfqf0lk4ujmo	15277896	/api/external/playerOffline	{"token": "37315de7e95dac229518c6ba77a3cacc", "user_id": "15277896", "agent_id": "178114", "timestamp": "1783234289"}	{"msg": "Success", "code": 0, "data": null, "count": 0}	200	\N	\N	2026-07-05 01:21:30.07
cmr7fnpw0000o7di64vwfwh38	cmr69xaxy0000yfqf0lk4ujmo	15277896	/api/external/recharge	{"token": "e25fcf984fe34e6ac238970fc75023f5", "amount": "13", "user_id": "15277896", "agent_id": "178114", "order_id": "TX_1783234293253_j9228", "timestamp": "1783234297"}	{"msg": "Success", "code": 0, "data": {"amount": "13", "pay_order_id": "TX_1783234293253_j9228", "user_balance": "13", "agent_balance": "987", "transaction_id": "1783234297917758", "transaction_time": "1783234297"}, "count": 0}	200	\N	\N	2026-07-05 01:21:37.296
cmr7fnwiv000s7di67kcz2dhq	cmr69xaxy0000yfqf0lk4ujmo	15277896	/api/external/userBalance	{"token": "5c05e3cf9ea3da6cc4dde971da30d4a6", "user_id": "15277896", "agent_id": "178114", "timestamp": "1783234305"}	{"msg": "Success", "code": 0, "data": {"user_balance": "13"}, "count": 0}	200	\N	\N	2026-07-05 01:21:45.895
cmrgtiosc0001w9e5h3a2zqqq	cmr69xaxy0000yfqf0lk4ujmo	15290343	/api/external/userBalance	{"user_id": "15290343"}	"read ECONNRESET"	500	read ECONNRESET	\N	2026-07-11 14:59:32.796
cmr7forqn000u7di6rmu7xbwa	cmr69xaxy0000yfqf0lk4ujmo	15277896	/api/external/userBalance	{"token": "6534f6547223616c637099ef794dd523", "user_id": "15277896", "agent_id": "178114", "timestamp": "1783234346"}	{"msg": "Success", "code": 0, "data": {"user_balance": "13"}, "count": 0}	200	\N	\N	2026-07-05 01:22:26.351
cmr7fu585000w7di69dkvdkp3	cmr69xaxy0000yfqf0lk4ujmo	15277896	/api/external/userBalance	{"token": "39549ed331ae3fc03615477ceeedf052", "user_id": "15277896", "agent_id": "178114", "timestamp": "1783234596"}	{"msg": "Success", "code": 0, "data": {"user_balance": "13"}, "count": 0}	200	\N	\N	2026-07-05 01:26:37.109
cmr7gtpp90001z4n53ss9ng72	cmr69xaxy0000yfqf0lk4ujmo	15277896	/api/external/userBalance	{"token": "cc256d695644e0bf49505fd48e48bcf5", "user_id": "15277896", "agent_id": "178114", "timestamp": "1783236256407"}	{"msg": "Token expired", "code": 4, "data": [], "count": 0}	4	Token Expired	\N	2026-07-05 01:54:16.605
cmr7gtqj70003z4n5rn65f57r	cmr69xaxy0000yfqf0lk4ujmo	15277896	/api/external/userBalance	{"token": "06ad06598971528fcfaea17d56cdb9df", "user_id": "15277896", "agent_id": "178114", "timestamp": "1783236257"}	{"msg": "Success", "code": 0, "data": {"user_balance": "13"}, "count": 0}	200	\N	\N	2026-07-05 01:54:17.683
cmr7gv1z00005z4n5520hkub0	cmr69xaxy0000yfqf0lk4ujmo	15277896	/api/external/userBalance	{"token": "15d7962fa59ca9945d7912f3e87d2a18", "user_id": "15277896", "agent_id": "178114", "timestamp": "1783236319"}	{"msg": "Success", "code": 0, "data": {"user_balance": "13"}, "count": 0}	200	\N	\N	2026-07-05 01:55:19.164
cmr7gvv3l0001tdkawsofyjmw	cmr69xaxy0000yfqf0lk4ujmo	15277896	/api/external/userBalance	{"token": "d5a8565c94631176169fae9b4cfabe7c", "user_id": "15277896", "agent_id": "178114", "timestamp": "1783236356777"}	{"msg": "Token expired", "code": 4, "data": [], "count": 0}	4	Token Expired	\N	2026-07-05 01:55:56.913
cmr7gvvx20003tdkayvpktafi	cmr69xaxy0000yfqf0lk4ujmo	15277896	/api/external/userBalance	{"token": "ea2d14a185cf9bae39bbba1b3937ec8d", "user_id": "15277896", "agent_id": "178114", "timestamp": "1783236357"}	{"msg": "Success", "code": 0, "data": {"user_balance": "13"}, "count": 0}	200	\N	\N	2026-07-05 01:55:57.974
cmr7gxuar0005tdkakqlzg5yz	cmr69xaxy0000yfqf0lk4ujmo	15277896	/api/external/userBalance	{"token": "b7a9631692791a2f16fd67436c49d3c5", "user_id": "15277896", "agent_id": "178114", "timestamp": "1783236449"}	{"msg": "Success", "code": 0, "data": {"user_balance": "0"}, "count": 0}	200	\N	\N	2026-07-05 01:57:29.187
cmr7gyt05000etdkahu4c535y	cmr69xaxy0000yfqf0lk4ujmo	15277896	/api/external/userBalance	{"token": "0434f6904ac1bf0feabf8cb4cf1095c0", "user_id": "15277896", "agent_id": "178114", "timestamp": "1783236494"}	{"msg": "Success", "code": 0, "data": {"user_balance": "0"}, "count": 0}	200	\N	\N	2026-07-05 01:58:14.166
cmr7gyz0t000gtdka0x7y6wm7	cmr69xaxy0000yfqf0lk4ujmo	15277896	/api/external/playerOffline	{"token": "d6c0a0b3057805b239e266f640637de4", "user_id": "15277896", "agent_id": "178114", "timestamp": "1783236501"}	{"msg": "Success", "code": 0, "data": null, "count": 0}	200	\N	\N	2026-07-05 01:58:21.965
cmr7gz4m4000ktdka50wunfyc	cmr69xaxy0000yfqf0lk4ujmo	15277896	/api/external/recharge	{"token": "c01be3cbeb803eb7ef511bacdbf4bb63", "amount": "13", "user_id": "15277896", "agent_id": "178114", "order_id": "TX_1783236505093_uzvkn", "timestamp": "1783236509"}	{"msg": "Success", "code": 0, "data": {"amount": "13", "pay_order_id": "TX_1783236505093_uzvkn", "user_balance": "13", "agent_balance": "987", "transaction_id": "1783236509918046", "transaction_time": "1783236509"}, "count": 0}	200	\N	\N	2026-07-05 01:58:29.211
cmr7gzb18000otdka51y2vk83	cmr69xaxy0000yfqf0lk4ujmo	15277896	/api/external/userBalance	{"token": "295707a37512e46b18f4d44659221be4", "user_id": "15277896", "agent_id": "178114", "timestamp": "1783236517"}	{"msg": "Success", "code": 0, "data": {"user_balance": "13"}, "count": 0}	200	\N	\N	2026-07-05 01:58:37.532
cmr7h878h0001gyugffln84n7	cmr69xaxy0000yfqf0lk4ujmo	15277896	/api/external/userBalance	{"token": "82ad19dde14f909a203c36745f544a89", "user_id": "15277896", "agent_id": "178114", "timestamp": "1783236932286"}	{"msg": "Token expired", "code": 4, "data": [], "count": 0}	4	Token Expired	\N	2026-07-05 02:05:32.513
cmr7h881u0003gyuggp55ardp	cmr69xaxy0000yfqf0lk4ujmo	15277896	/api/external/userBalance	{"token": "847e06e6ac8f79100728effb28fa878d", "user_id": "15277896", "agent_id": "178114", "timestamp": "1783236933"}	{"msg": "Success", "code": 0, "data": {"user_balance": "13"}, "count": 0}	200	\N	\N	2026-07-05 02:05:33.57
cmr7h8cm90005gyugqubks5n0	cmr69xaxy0000yfqf0lk4ujmo	15277896	/api/external/userBalance	{"token": "90a765b088eec650e56361e5bc7c6363", "user_id": "15277896", "agent_id": "178114", "timestamp": "1783236939"}	{"msg": "Success", "code": 0, "data": {"user_balance": "13"}, "count": 0}	200	\N	\N	2026-07-05 02:05:39.489
cmr7hzvnh0001dp3o4ilmmw3z	cmr69xaxy0000yfqf0lk4ujmo	15277896	/api/external/userBalance	{"token": "32ef4cf9d39ba2981f1966d2574dfedf", "user_id": "15277896", "agent_id": "178114", "timestamp": "1783238223660"}	{"msg": "Token expired", "code": 4, "data": [], "count": 0}	4	Token Expired	\N	2026-07-05 02:27:03.87
cmr7hzwh80003dp3o9dt41zmn	cmr69xaxy0000yfqf0lk4ujmo	15277896	/api/external/userBalance	{"token": "993d79f84bb4c8bc59f6b08935371f5d", "user_id": "15277896", "agent_id": "178114", "timestamp": "1783238224"}	{"msg": "Success", "code": 0, "data": {"user_balance": "13"}, "count": 0}	200	\N	\N	2026-07-05 02:27:04.94
cmr7i0ewo0005dp3oj73vpotq	cmr69xaxy0000yfqf0lk4ujmo	15277896	/api/external/userBalance	{"token": "df2e8502248625b0214851206821d05a", "user_id": "15277896", "agent_id": "178114", "timestamp": "1783238248"}	{"msg": "Success", "code": 0, "data": {"user_balance": "13"}, "count": 0}	200	\N	\N	2026-07-05 02:27:28.824
cmr7kt0i4000gnggf0mhhy9fi	cmr69xaxy0000yfqf0lk4ujmo	\N	/api/external/addUser	{"token": "c3434391769a41c22f835205063f87f6", "account": "annalaurel_pl12", "agent_id": "178114", "login_pwd": "Default123!", "timestamp": "1783242942269"}	{"msg": "Token expired", "code": 4, "data": [], "count": 0}	4	Token Expired	\N	2026-07-05 03:45:42.412
cmr7kt1dk000inggfja6p4n96	cmr69xaxy0000yfqf0lk4ujmo	\N	/api/external/addUser	{"token": "ba0084df77a396eccf1f8a73575e3c84", "account": "annalaurel_pl12", "agent_id": "178114", "login_pwd": "Default123!", "timestamp": "1783242943"}	{"msg": "Account name already exists", "code": 20, "data": [], "count": 0}	20	Username Already Exists	\N	2026-07-05 03:45:43.545
cmr7kt2e2000knggf100x7f55	cmr69xaxy0000yfqf0lk4ujmo	\N	/api/external/addUser	{"token": "4226f99a7a2dda2388f37a57b0ba2544", "account": "annalaurel_9575", "agent_id": "178114", "login_pwd": "Default123!", "timestamp": "1783242944578"}	{"msg": "Token expired", "code": 4, "data": [], "count": 0}	4	Token Expired	\N	2026-07-05 03:45:44.651
cmrgtirhw0003w9e58w6775fk	cmr69xaxy0000yfqf0lk4ujmo	15290343	/api/external/userBalance	{"user_id": "15290343"}	"read ECONNRESET"	500	read ECONNRESET	\N	2026-07-11 14:59:36.308
cmr7kt392000mnggfczami0n8	cmr69xaxy0000yfqf0lk4ujmo	\N	/api/external/addUser	{"token": "c93da0c141375d9b8e3bc78a11c148ce", "account": "annalaurel_9575", "agent_id": "178114", "login_pwd": "Default123!", "timestamp": "1783242945"}	{"msg": "Success", "code": 0, "data": {"user_id": "15279483", "account_name": "annalaurel_9575"}, "count": 0}	200	\N	\N	2026-07-05 03:45:45.974
cmr7kt85q000qnggfqvooi35d	cmr69xaxy0000yfqf0lk4ujmo	15279483	/api/external/userBalance	{"token": "eb2ee37625d65f12187ec8610dbb2fa0", "user_id": "15279483", "agent_id": "178114", "timestamp": "1783242952"}	{"msg": "Success", "code": 0, "data": {"user_balance": "0"}, "count": 0}	200	\N	\N	2026-07-05 03:45:52.334
cmr7ktetm000snggfhhbr26je	cmr69xaxy0000yfqf0lk4ujmo	15279483	/api/external/playerOffline	{"token": "fb837a444861c3a51354812ebfecde21", "user_id": "15279483", "agent_id": "178114", "timestamp": "1783242960"}	{"msg": "Success", "code": 0, "data": null, "count": 0}	200	\N	\N	2026-07-05 03:46:00.763
cmr7ktkhg000wnggfz6medzea	cmr69xaxy0000yfqf0lk4ujmo	15279483	/api/external/recharge	{"token": "24bc541409c1dc6f1bf8aac435ec7792", "amount": "10", "user_id": "15279483", "agent_id": "178114", "order_id": "TX_1783242964178_rq5i1", "timestamp": "1783242968"}	{"msg": "Success", "code": 0, "data": {"amount": "10", "pay_order_id": "TX_1783242964178_rq5i1", "user_balance": "10", "agent_balance": "977", "transaction_id": "1783242968918747", "transaction_time": "1783242968"}, "count": 0}	200	\N	\N	2026-07-05 03:46:08.309
cmr7ktrbj0010nggf9j3uxiqw	cmr69xaxy0000yfqf0lk4ujmo	15279483	/api/external/userBalance	{"token": "813f8bbbbc2d10c0278b4c2d0785442e", "user_id": "15279483", "agent_id": "178114", "timestamp": "1783242977"}	{"msg": "Success", "code": 0, "data": {"user_balance": "10"}, "count": 0}	200	\N	\N	2026-07-05 03:46:17.168
cmr7kulkn0012nggfec07j9n3	cmr5ffgpe000mqs55ym8xwjyg	\N	/api/external/addUser	{"token": "e7a0cee26a65545fac6f5a9ad60c13fa", "account": "annalaurel_pl12", "agent_id": "944", "login_pwd": "Default123!", "timestamp": "1783243015871"}	{"msg": "unKnownErrorCode", "code": 4, "data": [], "count": 0}	4	Token Expired	\N	2026-07-05 03:46:56.169
cmr7kumeo0014nggfam51of0m	cmr5ffgpe000mqs55ym8xwjyg	\N	/api/external/addUser	{"token": "b176135735fcc72442092455b4e58e2c", "account": "annalaurel_pl12", "agent_id": "944", "login_pwd": "Default123!", "timestamp": "1783243017"}	{"msg": "unKnownErrorCode", "code": 0, "data": {"user_id": "1485006", "account_name": "annalaurel_pl12"}, "count": 0}	200	\N	\N	2026-07-05 03:46:57.456
cmr7kurec0018nggf5a106ama	cmr5ffgpe000mqs55ym8xwjyg	1485006	/api/external/userBalance	{"token": "af2847dd822df5c852a4ea66f02029fb", "user_id": "1485006", "agent_id": "944", "timestamp": "1783243023"}	{"msg": "unKnownErrorCode", "code": 0, "data": {"user_balance": "0"}, "count": 0}	200	\N	\N	2026-07-05 03:47:03.924
cmr7kv327001anggf8y4bjraa	cmr5ffgpe000mqs55ym8xwjyg	1485006	/api/external/playerOffline	{"token": "1d9bfdd55d5667117c1eb4dc18a20249", "user_id": "1485006", "agent_id": "944", "timestamp": "1783243038"}	{"msg": "unKnownErrorCode", "code": 0, "data": null, "count": 0}	200	\N	\N	2026-07-05 03:47:19.039
cmr7kv8rt001enggfvyk10sdt	cmr5ffgpe000mqs55ym8xwjyg	1485006	/api/external/recharge	{"token": "df3c7833707725746a0c061c2e313df5", "amount": "6.5", "user_id": "1485006", "agent_id": "944", "order_id": "TX_1783243042290_38lno", "timestamp": "1783243046"}	{"msg": "unKnownErrorCode", "code": 0, "data": {"amount": "6.5", "pay_order_id": "TX_1783243042290_38lno", "user_balance": "6.5", "agent_balance": "2393.3", "transaction_id": "178324304639243", "transaction_time": "1783243046"}, "count": 0}	200	\N	\N	2026-07-05 03:47:26.442
cmr7kvfg9001inggfr0wmn74r	cmr5ffgpe000mqs55ym8xwjyg	1485006	/api/external/userBalance	{"token": "a52de48bb2e412581848238576d17db9", "user_id": "1485006", "agent_id": "944", "timestamp": "1783243055"}	{"msg": "unKnownErrorCode", "code": 0, "data": {"user_balance": "6.5"}, "count": 0}	200	\N	\N	2026-07-05 03:47:35.097
cmr7kvn6s001knggfmcwsi449	cmr5ffgpe000mqs55ym8xwjyg	1485006	/api/external/userBalance	{"token": "8b5214e0cdf9492bdbed61591209c22d", "user_id": "1485006", "agent_id": "944", "timestamp": "1783243063"}	{"msg": "unKnownErrorCode", "code": 0, "data": {"user_balance": "6.5"}, "count": 0}	200	\N	\N	2026-07-05 03:47:43.773
cmr7l6aaf001onggfbz1o5zm9	cmr69xaxy0000yfqf0lk4ujmo	15279483	/api/external/userBalance	{"token": "c55d15a2f81e8791a02aca8990132366", "user_id": "15279483", "agent_id": "178114", "timestamp": "1783243561"}	{"msg": "Success", "code": 0, "data": {"user_balance": "10"}, "count": 0}	200	\N	\N	2026-07-05 03:56:01.623
cmr7l6lcb001qnggf73nkb69b	cmr69xaxy0000yfqf0lk4ujmo	15279483	/api/external/resetPassword	{"token": "408f1ba325dc934302835e9fd58a1c3c", "user_id": "15279483", "agent_id": "178114", "login_pwd": "NxS_ffc6c1d8", "timestamp": "1783243575"}	{"msg": "Success", "code": 0, "data": null, "count": 0}	200	\N	\N	2026-07-05 03:56:15.948
cmr7lk1a3001snggfm2002au8	cmr69xaxy0000yfqf0lk4ujmo	15279483	/api/external/userBalance	{"token": "f6612dd2d2886b82b447e1e3ee725baf", "user_id": "15279483", "agent_id": "178114", "timestamp": "1783244202"}	{"msg": "Success", "code": 0, "data": {"user_balance": "10.05"}, "count": 0}	200	\N	\N	2026-07-05 04:06:43.131
cmr7lkol1001unggfhscpajmw	cmr69xaxy0000yfqf0lk4ujmo	15279483	/api/external/userBalance	{"token": "d79658d9583e8123a40a86b0d7fc1174", "user_id": "15279483", "agent_id": "178114", "timestamp": "1783244233"}	{"msg": "Success", "code": 0, "data": {"user_balance": "10.05"}, "count": 0}	200	\N	\N	2026-07-05 04:07:13.333
cmr7lsuu7001ynggf2gyiiv1t	cmr5fjihw000vqs55y8i87kv5	\N	/api/external/agentBalance	{"token": "7105db69099f4c68eb222a34d1ad9d3e", "agent_id": "37220", "timestamp": "1783244614515"}	{"msg": "Token expired", "code": 4, "data": [], "count": 0}	4	Token Expired	\N	2026-07-05 04:13:34.687
cmr7lsvo60020nggfekj0o3xf	cmr5fjihw000vqs55y8i87kv5	\N	/api/external/agentBalance	{"token": "f8a4f28db284dc5a62c0e8a91d98fb9a", "agent_id": "37220", "timestamp": "1783244615"}	{"msg": "Success", "code": 0, "data": {"agent_balance": "1318.14"}, "count": 0}	200	\N	\N	2026-07-05 04:13:35.766
cmr7lsw8d0022nggfq6c9ctp9	cmr5ffgpe000mqs55ym8xwjyg	\N	/api/external/agentBalance	{"token": "058b6fec07ca58a9c9a28874754e9276", "agent_id": "944", "timestamp": "1783244616"}	{"msg": "unKnownErrorCode", "code": 0, "data": {"agent_balance": "2399.8"}, "count": 0}	200	\N	\N	2026-07-05 04:13:36.494
cmr7lsy890026nggfd32okmpe	\N	\N	/api/external/agentBalance	{"token": "f585b6c2816f2b6e38a315604d478129", "agent_id": "122030", "timestamp": "1783244619"}	{"msg": "unKnownErrorCode", "code": 5, "data": [], "count": 0}	5	Access IP Not Whitelisted	\N	2026-07-05 04:13:39.081
cmr7lsylb0028nggft5iyylla	cmr69xaxy0000yfqf0lk4ujmo	\N	/api/external/agentBalance	{"token": "f1963cc9f3589c774c43f27f6fb26a0a", "agent_id": "178114", "timestamp": "1783244619"}	{"msg": "Success", "code": 0, "data": {"agent_balance": "1000.05"}, "count": 0}	200	\N	\N	2026-07-05 04:13:39.551
cmr7lvi65002inggfo0dw9ysq	cmr69xaxy0000yfqf0lk4ujmo	\N	/api/external/agentBalance	{"token": "805c7f86e3258a2bc0bfb1a9810e3819", "agent_id": "178114", "timestamp": "1783244738"}	{"msg": "Success", "code": 0, "data": {"agent_balance": "1000.05"}, "count": 0}	200	\N	\N	2026-07-05 04:15:38.237
cmr7lvlay002knggfegyl44z7	cmr5ffgpe000mqs55ym8xwjyg	\N	/api/external/agentBalance	{"token": "e6994e38d1bed44b3640b12642f0cad5", "agent_id": "944", "timestamp": "1783244742"}	{"msg": "unKnownErrorCode", "code": 0, "data": {"agent_balance": "2399.8"}, "count": 0}	200	\N	\N	2026-07-05 04:15:42.298
cmr7lvowi002mnggfqqzojrp8	cmr5fjihw000vqs55y8i87kv5	\N	/api/external/agentBalance	{"token": "4bdb2ef8585a206ecadd83c7b0763447", "agent_id": "37220", "timestamp": "1783244746"}	{"msg": "Success", "code": 0, "data": {"agent_balance": "1318.14"}, "count": 0}	200	\N	\N	2026-07-05 04:15:46.962
cmr7lsxfr0024nggfkvl3dgkl	\N	\N	/api/external/agentBalance	{"token": "5c1b2aabf04466c403aeb9a927ec0256", "agent_id": "122030", "timestamp": "1783244618011"}	{"msg": "unKnownErrorCode", "code": 4, "data": [], "count": 0}	4	Token Expired	\N	2026-07-05 04:13:38.056
cmr7lt58e002anggf8m41vtzx	\N	\N	/api/external/agentBalance	{"token": "eea5154233c2da92f28ad1a259e01195", "agent_id": "122030", "timestamp": "1783244628067"}	{"msg": "unKnownErrorCode", "code": 4, "data": [], "count": 0}	4	Token Expired	\N	2026-07-05 04:13:48.158
cmr7lt602002cnggfm2zvc00j	\N	\N	/api/external/agentBalance	{"token": "f9c18ba670f1463bfe523498adb575b9", "agent_id": "122030", "timestamp": "1783244629"}	{"msg": "unKnownErrorCode", "code": 5, "data": [], "count": 0}	5	Access IP Not Whitelisted	\N	2026-07-05 04:13:49.154
cmr7lucsz002enggf8fqzv9h4	\N	\N	/api/external/agentBalance	{"token": "9df8dcf9a748a704ce51183aed2bc3fa", "agent_id": "122030", "timestamp": "1783244684541"}	{"msg": "unKnownErrorCode", "code": 4, "data": [], "count": 0}	4	Token Expired	\N	2026-07-05 04:14:44.627
cmr7ludkn002gnggfznf0dahd	\N	\N	/api/external/agentBalance	{"token": "c9bb9ae616696c30c13198e4ea771c31", "agent_id": "122030", "timestamp": "1783244685"}	{"msg": "unKnownErrorCode", "code": 5, "data": [], "count": 0}	5	Access IP Not Whitelisted	\N	2026-07-05 04:14:45.623
cmr7lvsi8002onggfslsqsv88	\N	\N	/api/external/agentBalance	{"token": "8483edefa9dbd08a5c1437a5bea92e25", "agent_id": "122030", "timestamp": "1783244751355"}	{"msg": "unKnownErrorCode", "code": 4, "data": [], "count": 0}	4	Token Expired	\N	2026-07-05 04:15:51.442
cmr7lvt9t002qnggf2p89q6q3	\N	\N	/api/external/agentBalance	{"token": "f7c889585d75c05acf2ee6622f713c8d", "agent_id": "122030", "timestamp": "1783244752"}	{"msg": "unKnownErrorCode", "code": 5, "data": [], "count": 0}	5	Access IP Not Whitelisted	\N	2026-07-05 04:15:52.626
cmr7lx2z0002tnggfnkfspupa	cmr7lwt20002rnggfbn8d7kil	\N	/api/external/agentBalance	{"token": "638bd7462ae1ee9884ad40061ba1d37d", "agent_id": "122030", "timestamp": "1783244811773"}	{"msg": "unKnownErrorCode", "code": 4, "data": [], "count": 0}	4	Token Expired	\N	2026-07-05 04:16:51.852
cmr7lx3qi002vnggfv04xk1eg	cmr7lwt20002rnggfbn8d7kil	\N	/api/external/agentBalance	{"token": "8891f16996ec506d885d04d8aee40d0d", "agent_id": "122030", "timestamp": "1783244812"}	{"msg": "unKnownErrorCode", "code": 5, "data": [], "count": 0}	5	Access IP Not Whitelisted	\N	2026-07-05 04:16:52.842
cmr7lx7a3002xnggf8rxiqe6l	cmr7lwt20002rnggfbn8d7kil	\N	/api/external/agentBalance	{"token": "bd830fcbffa5baa06c109f0971222d66", "agent_id": "122030", "timestamp": "1783244817388"}	{"msg": "unKnownErrorCode", "code": 4, "data": [], "count": 0}	4	Token Expired	\N	2026-07-05 04:16:57.435
cmr7lx81m002znggff5bab63l	cmr7lwt20002rnggfbn8d7kil	\N	/api/external/agentBalance	{"token": "af37d43a2be606263ef1c5e5156ec5c0", "agent_id": "122030", "timestamp": "1783244818"}	{"msg": "unKnownErrorCode", "code": 5, "data": [], "count": 0}	5	Access IP Not Whitelisted	\N	2026-07-05 04:16:58.426
cmr7lyylh0031nggfpyt3ymxl	cmr7lwt20002rnggfbn8d7kil	\N	/api/external/agentBalance	{"token": "5eb2eb35ccf0ff5a7d3995f16d6e88a4", "agent_id": "122030", "timestamp": "1783244899407"}	{"msg": "unKnownErrorCode", "code": 4, "data": [], "count": 0}	4	Token Expired	\N	2026-07-05 04:18:19.493
cmr7lyzd60033nggf12ambynn	cmr7lwt20002rnggfbn8d7kil	\N	/api/external/agentBalance	{"token": "0f595ce49b15297efdb0eabc737e9304", "agent_id": "122030", "timestamp": "1783244900"}	{"msg": "unKnownErrorCode", "code": 5, "data": [], "count": 0}	5	Access IP Not Whitelisted	\N	2026-07-05 04:18:20.49
cmr7lz2dg0035nggfoxtwqaa3	cmr5ffgpe000mqs55ym8xwjyg	\N	/api/external/agentBalance	{"token": "00fbca8c2c3d147f2ab32af3bdbab65e", "agent_id": "944", "timestamp": "1783244904"}	{"msg": "unKnownErrorCode", "code": 0, "data": {"agent_balance": "2399.8"}, "count": 0}	200	\N	\N	2026-07-05 04:18:24.389
cmr7lz7r30037nggfufjogjr1	cmr5fjihw000vqs55y8i87kv5	\N	/api/external/agentBalance	{"token": "ee17ae2aa9504268cc674950e0d9962b", "agent_id": "37220", "timestamp": "1783244911"}	{"msg": "Success", "code": 0, "data": {"agent_balance": "1318.14"}, "count": 0}	200	\N	\N	2026-07-05 04:18:31.359
cmr7lzbcn0039nggfwksyx7xc	cmr69xaxy0000yfqf0lk4ujmo	\N	/api/external/agentBalance	{"token": "bd5e6f682d07ab8966ccef812c2f0e98", "agent_id": "178114", "timestamp": "1783244915"}	{"msg": "Success", "code": 0, "data": {"agent_balance": "1000.05"}, "count": 0}	200	\N	\N	2026-07-05 04:18:36.023
cmr7lzgpg003bnggftch63ca0	cmr7lwt20002rnggfbn8d7kil	\N	/api/external/agentBalance	{"token": "3a3286fe0ae3a0b1d649bedd09af793a", "agent_id": "122030", "timestamp": "1783244922847"}	{"msg": "unKnownErrorCode", "code": 4, "data": [], "count": 0}	4	Token Expired	\N	2026-07-05 04:18:42.964
cmr7lzhhw003dnggfbb0tgpiw	cmr7lwt20002rnggfbn8d7kil	\N	/api/external/agentBalance	{"token": "792e509c6d6450d7cc27b39a731f7b93", "agent_id": "122030", "timestamp": "1783244923"}	{"msg": "unKnownErrorCode", "code": 5, "data": [], "count": 0}	5	Access IP Not Whitelisted	\N	2026-07-05 04:18:43.988
cmr7m1atv003fnggfo2bhf216	cmr5ffgpe000mqs55ym8xwjyg	1485006	/api/external/userBalance	{"token": "e24b1450207ca8c417bf87c5e510231e", "user_id": "1485006", "agent_id": "944", "timestamp": "1783245008"}	{"msg": "unKnownErrorCode", "code": 0, "data": {"user_balance": "0"}, "count": 0}	200	\N	\N	2026-07-05 04:20:08.659
cmr7m1j6l003hnggfrtb5mfv0	cmr7lwt20002rnggfbn8d7kil	\N	/api/external/addUser	{"token": "bae7896011bc65955b94a501df86df5d", "account": "annalaurel_pl12", "agent_id": "122030", "login_pwd": "Default123!", "timestamp": "1783245019405"}	{"msg": "unKnownErrorCode", "code": 4, "data": [], "count": 0}	4	Token Expired	\N	2026-07-05 04:20:19.486
cmr7m1jzh003jnggfyz2bxpbb	cmr7lwt20002rnggfbn8d7kil	\N	/api/external/addUser	{"token": "9939c84cd9cbded06bbfffe35d808f51", "account": "annalaurel_pl12", "agent_id": "122030", "login_pwd": "Default123!", "timestamp": "1783245020"}	{"msg": "unKnownErrorCode", "code": 5, "data": [], "count": 0}	5	Access IP Not Whitelisted	\N	2026-07-05 04:20:20.525
cmr7m2uu3003lnggf0pbijpxn	cmr7lwt20002rnggfbn8d7kil	\N	/api/external/agentBalance	{"token": "1b6a23cff979106ed4bf4e427a8c7e98", "agent_id": "122030", "timestamp": "1783245081160"}	{"msg": "unKnownErrorCode", "code": 4, "data": [], "count": 0}	4	Token Expired	\N	2026-07-05 04:21:21.244
cmr7m2vu3003nnggfrtspfndu	cmr7lwt20002rnggfbn8d7kil	\N	/api/external/agentBalance	{"token": "ea3f25f5aa76762eac5fb2326d9e30bc", "agent_id": "122030", "timestamp": "1783245082"}	{"msg": "unKnownErrorCode", "code": 5, "data": [], "count": 0}	5	Access IP Not Whitelisted	\N	2026-07-05 04:21:22.331
cmr7ma2wq003pnggfzt5msdxa	cmr7lwt20002rnggfbn8d7kil	\N	/api/external/agentBalance	{"token": "d22d43c1429aa35876fc36f65dac498d", "agent_id": "122030", "timestamp": "1783245418028"}	{"msg": "unKnownErrorCode", "code": 4, "data": [], "count": 0}	4	Token Expired	\N	2026-07-05 04:26:58.298
cmr7ma3oy003rnggfckn8ble2	cmr7lwt20002rnggfbn8d7kil	\N	/api/external/agentBalance	{"token": "fb448df64058c872ff6bb6e602218671", "agent_id": "122030", "timestamp": "1783245419"}	{"msg": "unKnownErrorCode", "code": 5, "data": [], "count": 0}	5	Access IP Not Whitelisted	\N	2026-07-05 04:26:59.314
cmr7maa9r003tnggfe2avyz8a	cmr5fjihw000vqs55y8i87kv5	\N	/api/external/agentBalance	{"token": "6a1f260c91b0d076cea636511918dc06", "agent_id": "37220", "timestamp": "1783245427"}	{"msg": "Success", "code": 0, "data": {"agent_balance": "1318.14"}, "count": 0}	200	\N	\N	2026-07-05 04:27:07.839
cmr7madqt003vnggfp3fzwdgq	cmr5ffgpe000mqs55ym8xwjyg	\N	/api/external/agentBalance	{"token": "5375406071b1edf860fec4c21369725f", "agent_id": "944", "timestamp": "1783245432"}	{"msg": "unKnownErrorCode", "code": 0, "data": {"agent_balance": "2399.8"}, "count": 0}	200	\N	\N	2026-07-05 04:27:12.341
cmr7mafh0003xnggfiqwy7tdw	cmr69xaxy0000yfqf0lk4ujmo	\N	/api/external/agentBalance	{"token": "c20dffa28691951c51defa2f834abbca", "agent_id": "178114", "timestamp": "1783245434"}	{"msg": "Success", "code": 0, "data": {"agent_balance": "1000.05"}, "count": 0}	200	\N	\N	2026-07-05 04:27:14.58
cmr7maini003znggfnl548ctu	cmr7lwt20002rnggfbn8d7kil	\N	/api/external/agentBalance	{"token": "2d53e234cbb7ab1be8df2ce15db24a6a", "agent_id": "122030", "timestamp": "1783245438618"}	{"msg": "unKnownErrorCode", "code": 4, "data": [], "count": 0}	4	Token Expired	\N	2026-07-05 04:27:18.702
cmr7majfl0041nggfx148ajpb	cmr7lwt20002rnggfbn8d7kil	\N	/api/external/agentBalance	{"token": "e38af10c912b87e2225ab3ac954da7b3", "agent_id": "122030", "timestamp": "1783245439"}	{"msg": "unKnownErrorCode", "code": 5, "data": [], "count": 0}	5	Access IP Not Whitelisted	\N	2026-07-05 04:27:19.713
cmr7mo2cz0043nggf7sbv57op	cmr7lwt20002rnggfbn8d7kil	\N	/api/external/agentBalance	{"token": "02f3c8205d6ef50cab6a460bb30b02cf", "agent_id": "122030", "timestamp": "1783246070645"}	{"msg": "Token expired", "code": 4, "data": [], "count": 0}	4	Token Expired	\N	2026-07-05 04:37:50.771
cmr7mo2z40045nggf13lxk9be	cmr7lwt20002rnggfbn8d7kil	\N	/api/external/agentBalance	{"token": "083bdf2b0245f35e58dd413558eefc91", "agent_id": "122030", "timestamp": "1783246071524"}	{"msg": "Token expired", "code": 4, "data": [], "count": 0}	4	Token Expired	\N	2026-07-05 04:37:51.568
cmr7mo38l0047nggfrq52wbki	cmr7lwt20002rnggfbn8d7kil	\N	/api/external/agentBalance	{"token": "877b9de6421417444bbb6ddc6f0da70d", "agent_id": "122030", "timestamp": "1783246071"}	{"msg": "Success", "code": 0, "data": {"agent_balance": "1000"}, "count": 0}	200	\N	\N	2026-07-05 04:37:51.909
cmr7mo3zw0049nggff0xhdiir	cmr7lwt20002rnggfbn8d7kil	\N	/api/external/agentBalance	{"token": "ed6616d640b411d862448b28f5b83351", "agent_id": "122030", "timestamp": "1783246072"}	{"msg": "Success", "code": 0, "data": {"agent_balance": "1000"}, "count": 0}	200	\N	\N	2026-07-05 04:37:52.679
cmr7mo7hl004bnggfrcp505gy	cmr5fjihw000vqs55y8i87kv5	\N	/api/external/agentBalance	{"token": "aeecf4d4163b7462d53c91a0f2e91fef", "agent_id": "37220", "timestamp": "1783246077"}	{"msg": "Success", "code": 0, "data": {"agent_balance": "1318.14"}, "count": 0}	200	\N	\N	2026-07-05 04:37:57.417
cmr7mqgdy00031bi463gf3ppk	cmr69xaxy0000yfqf0lk4ujmo	\N	/api/external/agentBalance	{"token": "c7ee12a3dac36caa0e060339113e4c77", "agent_id": "178114", "timestamp": "1783246181932"}	{"msg": "Token expired", "code": 4, "data": [], "count": 0}	4	Token Expired	\N	2026-07-05 04:39:42.262
cmr7mqh6h00051bi4myf84if6	cmr69xaxy0000yfqf0lk4ujmo	\N	/api/external/agentBalance	{"token": "75d20793ba6b2913932031e9130daa1e", "agent_id": "178114", "timestamp": "1783246183"}	{"msg": "Success", "code": 0, "data": {"agent_balance": "1000.05"}, "count": 0}	200	\N	\N	2026-07-05 04:39:43.29
cmr7msjmq00071bi4ak6418rr	cmr5ffgpe000mqs55ym8xwjyg	\N	/api/external/agentBalance	{"token": "f672de514f7f56a1638bd11f36016daa", "agent_id": "944", "timestamp": "1783246279504"}	{"msg": "unKnownErrorCode", "code": 4, "data": [], "count": 0}	4	Token Expired	\N	2026-07-05 04:41:19.779
cmr7mskfy00091bi4hjg10vby	cmr5ffgpe000mqs55ym8xwjyg	\N	/api/external/agentBalance	{"token": "0245bec0e5416b3ee42020b1cb6139fc", "agent_id": "944", "timestamp": "1783246280"}	{"msg": "unKnownErrorCode", "code": 0, "data": {"agent_balance": "2379.8"}, "count": 0}	200	\N	\N	2026-07-05 04:41:20.831
cmr7mso9h000b1bi4mbvd38hb	cmr7lwt20002rnggfbn8d7kil	\N	/api/external/agentBalance	{"token": "e7581e1c266d2bc4582ab6d324f596dd", "agent_id": "122030", "timestamp": "1783246285685"}	{"msg": "Token expired", "code": 4, "data": [], "count": 0}	4	Token Expired	\N	2026-07-05 04:41:25.781
cmr7msp2g000d1bi481cn0sth	cmr7lwt20002rnggfbn8d7kil	\N	/api/external/agentBalance	{"token": "4520a3db51883276966d97992aefd448", "agent_id": "122030", "timestamp": "1783246286"}	{"msg": "Success", "code": 0, "data": {"agent_balance": "1000"}, "count": 0}	200	\N	\N	2026-07-05 04:41:26.824
cmr7wsluu000h1bi461puhkts	cmr5fjihw000vqs55y8i87kv5	\N	/api/external/getUserID	{"token": "32a8bdf4b2ef020dbfd142c2153ab651", "agent_id": "37220", "timestamp": "1783263078509", "account_name": "wXfmMscAIVoYXscoLvAe"}	{"msg": "Token expired", "code": 4, "data": [], "count": 0}	4	Token Expired	\N	2026-07-05 09:21:18.823
cmr7wsmq3000j1bi4g57h6d40	cmr5fjihw000vqs55y8i87kv5	\N	/api/external/getUserID	{"token": "c90916eda06daa7f9aa0cfae8ee432dc", "agent_id": "37220", "timestamp": "1783263079", "account_name": "wXfmMscAIVoYXscoLvAe"}	{"msg": "Invalid user ID", "code": 8, "data": [], "count": 0}	8	Invalid User ID	\N	2026-07-05 09:21:19.948
cmr7wsszm000o1bi49uzkzqnf	cmr5fjihw000vqs55y8i87kv5	\N	/api/external/addUser	{"token": "023c75102c052bdc65aa2464426f3de7", "account": "wXfmMscAIVoYXscoLvAe", "agent_id": "37220", "login_pwd": "1NCM7J2HRDS1hAa1!", "timestamp": "1783263087937"}	{"msg": "Token expired", "code": 4, "data": [], "count": 0}	4	Token Expired	\N	2026-07-05 09:21:28.066
cmrguvhpw0001xa0dntzmatcs	cmr69xaxy0000yfqf0lk4ujmo	15290343	/api/external/userBalance	{"user_id": "15290343"}	"read ECONNRESET"	500	read ECONNRESET	\N	2026-07-11 15:37:29.779
cmr7wstvd000q1bi4ubebo2ub	cmr5fjihw000vqs55y8i87kv5	\N	/api/external/addUser	{"token": "a1ca8c7165e6520225a884f0724f8140", "account": "wXfmMscAIVoYXscoLvAe", "agent_id": "37220", "login_pwd": "1NCM7J2HRDS1hAa1!", "timestamp": "1783263089"}	{"msg": "Success", "code": 0, "data": {"user_id": "15281512", "account_name": "wxfmmscaivoyxscolvae"}, "count": 0}	200	\N	\N	2026-07-05 09:21:29.209
cmr8usgnm0003d1fm28snav0z	cmr69xaxy0000yfqf0lk4ujmo	\N	/api/external/addUser	{"token": "02461cb57db5b4523d9246d7ddd890f9", "account": "admin", "agent_id": "178114", "login_pwd": "Default123!", "timestamp": "1783320178719"}	{"msg": "Token expired", "code": 4, "data": [], "count": 0}	4	Token Expired	\N	2026-07-06 01:12:59.026
cmr8ushhl0005d1fm0238ylxr	cmr69xaxy0000yfqf0lk4ujmo	\N	/api/external/addUser	{"token": "d75eea0321aabf3c45c367d77f3365d1", "account": "admin", "agent_id": "178114", "login_pwd": "Default123!", "timestamp": "1783320180"}	{"msg": "Account name already exists", "code": 20, "data": [], "count": 0}	20	Username Already Exists	\N	2026-07-06 01:13:00.105
cmr8usibg0007d1fm7ab1c2lk	cmr69xaxy0000yfqf0lk4ujmo	\N	/api/external/addUser	{"token": "82f965da94a030dd84714acecc8d9806", "account": "admin_1448", "agent_id": "178114", "login_pwd": "Default123!", "timestamp": "1783320181101"}	{"msg": "Token expired", "code": 4, "data": [], "count": 0}	4	Token Expired	\N	2026-07-06 01:13:01.18
cmr8usj6m0009d1fmhy7tm1tm	cmr69xaxy0000yfqf0lk4ujmo	\N	/api/external/addUser	{"token": "046c97a53887ab755d254d7cb78a1598", "account": "admin_1448", "agent_id": "178114", "login_pwd": "Default123!", "timestamp": "1783320182"}	{"msg": "Success", "code": 0, "data": {"user_id": "15290343", "account_name": "admin_1448"}, "count": 0}	200	\N	\N	2026-07-06 01:13:02.302
cmr8uswxl000dd1fmss4ayfkw	cmr69xaxy0000yfqf0lk4ujmo	15290343	/api/external/userBalance	{"token": "4e204f2abe1db035fb3b18fef65bf468", "user_id": "15290343", "agent_id": "178114", "timestamp": "1783320199"}	{"msg": "Success", "code": 0, "data": {"user_balance": "0"}, "count": 0}	200	\N	\N	2026-07-06 01:13:20.121
cmr8uuc35000fd1fmk6hrn0ui	cmr69xaxy0000yfqf0lk4ujmo	15290343	/api/external/userBalance	{"token": "56eb2c5304f3a977b17d02f519934181", "user_id": "15290343", "agent_id": "178114", "timestamp": "1783320266"}	{"msg": "Success", "code": 0, "data": {"user_balance": "0"}, "count": 0}	200	\N	\N	2026-07-06 01:14:26.417
cmr8v9qfc000hd1fmulqybtya	cmr69xaxy0000yfqf0lk4ujmo	15277896	/api/external/userBalance	{"token": "a5186668e0625fdb3c9cd3ac1c4e2aa4", "user_id": "15277896", "agent_id": "178114", "timestamp": "1783320984"}	{"msg": "Success", "code": 0, "data": {"user_balance": "0"}, "count": 0}	200	\N	\N	2026-07-06 01:26:24.84
cmr8vco43000jd1fmgcqetz7u	cmr69xaxy0000yfqf0lk4ujmo	15277896	/api/external/userBalance	{"token": "b6763b5a4229d050e148c3da981b9fde", "user_id": "15277896", "agent_id": "178114", "timestamp": "1783321121"}	{"msg": "Success", "code": 0, "data": {"user_balance": "0"}, "count": 0}	200	\N	\N	2026-07-06 01:28:41.811
cmr8wr2pu000ld1fm9tiq1tm5	cmr69xaxy0000yfqf0lk4ujmo	15277896	/api/external/userBalance	{"token": "61fc21057c21c8dd062bf8834a6f2fe6", "user_id": "15277896", "agent_id": "178114", "timestamp": "1783323473"}	{"msg": "Success", "code": 0, "data": {"user_balance": "0"}, "count": 0}	200	\N	\N	2026-07-06 02:07:53.538
cmr8wrenz000nd1fm8dntqo3m	cmr69xaxy0000yfqf0lk4ujmo	15277896	/api/external/playerOffline	{"token": "78349367ffc2ba2c7a6ce1f28eadb478", "user_id": "15277896", "agent_id": "178114", "timestamp": "1783323488"}	{"msg": "Success", "code": 0, "data": null, "count": 0}	200	\N	\N	2026-07-06 02:08:09.024
cmr8wrlgx000rd1fmkhu0mbx5	cmr69xaxy0000yfqf0lk4ujmo	15277896	/api/external/recharge	{"token": "a590dccd3c885b042c95241136f134a1", "amount": "6.5", "user_id": "15277896", "agent_id": "178114", "order_id": "TX_1783323493008_8fy96", "timestamp": "1783323497"}	{"msg": "Success", "code": 0, "data": {"amount": "6.5", "pay_order_id": "TX_1783323493008_8fy96", "user_balance": "6.5", "agent_balance": "993.55", "transaction_id": "1783323497927753", "transaction_time": "1783323497"}, "count": 0}	200	\N	\N	2026-07-06 02:08:17.841
cmr8wrt33000vd1fmaemtpm01	cmr69xaxy0000yfqf0lk4ujmo	15277896	/api/external/userBalance	{"token": "575c646dd46504d61fc63ba77f311d2b", "user_id": "15277896", "agent_id": "178114", "timestamp": "1783323507"}	{"msg": "Success", "code": 0, "data": {"user_balance": "6.5"}, "count": 0}	200	\N	\N	2026-07-06 02:08:27.711
cmr8wvl3h000xd1fmnrurm9px	cmr69xaxy0000yfqf0lk4ujmo	15277896	/api/external/userBalance	{"token": "8dbecd16e0dd52c883e9302ed6ccd609", "user_id": "15277896", "agent_id": "178114", "timestamp": "1783323683"}	{"msg": "Success", "code": 0, "data": {"user_balance": "0"}, "count": 0}	200	\N	\N	2026-07-06 02:11:23.981
cmr8wvs68000zd1fmnwsdoleq	cmr69xaxy0000yfqf0lk4ujmo	15277896	/api/external/playerOffline	{"token": "38542a75328ca83c25c04ab898bd3c60", "user_id": "15277896", "agent_id": "178114", "timestamp": "1783323692"}	{"msg": "Success", "code": 0, "data": null, "count": 0}	200	\N	\N	2026-07-06 02:11:32.916
cmr8wy5xa0019d1fmpe8wqu4b	cmr69xaxy0000yfqf0lk4ujmo	15277896	/api/external/userBalance	{"token": "87bb64eebf8f39f932a6fee95eb9536e", "user_id": "15277896", "agent_id": "178114", "timestamp": "1783323804"}	{"msg": "Success", "code": 0, "data": {"user_balance": "0"}, "count": 0}	200	\N	\N	2026-07-06 02:13:24.287
cmr8wvz650013d1fmwzekxmzf	cmr69xaxy0000yfqf0lk4ujmo	15277896	/api/external/recharge	{"token": "6e843b39e6f10f8a1f6477842c1a6370", "amount": "6.5", "user_id": "15277896", "agent_id": "178114", "order_id": "TX_1783323697389_0xuhu", "timestamp": "1783323702"}	{"msg": "Success", "code": 0, "data": {"amount": "6.5", "pay_order_id": "TX_1783323697389_0xuhu", "user_balance": "6.5", "agent_balance": "993.55", "transaction_id": "1783323702927775", "transaction_time": "1783323702"}, "count": 0}	200	\N	\N	2026-07-06 02:11:42.221
cmr8ww5zk0017d1fmghybeb9x	cmr69xaxy0000yfqf0lk4ujmo	15277896	/api/external/userBalance	{"token": "b74aa618b4e33f94db22161b8001677d", "user_id": "15277896", "agent_id": "178114", "timestamp": "1783323710"}	{"msg": "Success", "code": 0, "data": {"user_balance": "6.5"}, "count": 0}	200	\N	\N	2026-07-06 02:11:50.824
cmr8yxh6o001bd1fmwhdfie7l	cmr69xaxy0000yfqf0lk4ujmo	15277896	/api/external/userBalance	{"token": "3068f88d8101fd3ef78ac6ad4014e330", "user_id": "15277896", "agent_id": "178114", "timestamp": "1783327131"}	{"msg": "Success", "code": 0, "data": {"user_balance": "0"}, "count": 0}	200	\N	\N	2026-07-06 03:08:51.456
cmravw12b001qd1fm72bh3ron	cmr5fjihw000vqs55y8i87kv5	\N	/api/external/getUserID	{"token": "a169df2307dad7c0208abb1fb0f06ad1", "agent_id": "37220", "timestamp": "1783442957059", "account_name": "Red"}	{"msg": "Token expired", "code": 4, "data": [], "count": 0}	4	Token Expired	\N	2026-07-07 11:19:17.412
cmrgyngqz0001z6o5uh6qwqpm	cmr69xaxy0000yfqf0lk4ujmo	15290343	/api/external/userBalance	{"user_id": "15290343"}	"read ECONNRESET"	500	read ECONNRESET	\N	2026-07-11 22:53:13.735
cmravw1w0001sd1fm5ot1lwdk	cmr5fjihw000vqs55y8i87kv5	\N	/api/external/getUserID	{"token": "4bb4c3cb6e56cdf1825a95f7a247588c", "agent_id": "37220", "timestamp": "1783442958", "account_name": "Red"}	{"msg": "Invalid user ID", "code": 8, "data": [], "count": 0}	8	Invalid User ID	\N	2026-07-07 11:19:18.481
cmravwe50001ud1fmd3cmmway	cmr5fjihw000vqs55y8i87kv5	\N	/api/external/getUserID	{"token": "4de24df5ee42b1257ddaa21c11b246b2", "agent_id": "37220", "timestamp": "1783442974245", "account_name": "rad"}	{"msg": "Token expired", "code": 4, "data": [], "count": 0}	4	Token Expired	\N	2026-07-07 11:19:34.356
cmravweye001wd1fmh4vp1zfc	cmr5fjihw000vqs55y8i87kv5	\N	/api/external/getUserID	{"token": "9a190bd421d72cbfe20fa1e00751242b", "agent_id": "37220", "timestamp": "1783442975", "account_name": "rad"}	{"msg": "Invalid user ID", "code": 8, "data": [], "count": 0}	8	Invalid User ID	\N	2026-07-07 11:19:35.414
cmravx16f0021d1fmpto01fk2	cmr5fjihw000vqs55y8i87kv5	\N	/api/external/addUser	{"token": "1ba9e2dc80bc794975c38fe584257b7e", "account": "rad", "agent_id": "37220", "login_pwd": "#Joker786", "timestamp": "1783443004088"}	{"msg": "Token expired", "code": 4, "data": [], "count": 0}	4	Token Expired	\N	2026-07-07 11:20:04.215
cmravx1zw0023d1fmjb2oblqu	cmr5fjihw000vqs55y8i87kv5	\N	/api/external/addUser	{"token": "d755864c1ee0423f19a5f7da04aefb5a", "account": "rad", "agent_id": "37220", "login_pwd": "#Joker786", "timestamp": "1783443005"}	{"msg": "Account name already exists", "code": 20, "data": [], "count": 0}	20	Username Already Exists	\N	2026-07-07 11:20:05.276
cmravx2tg0025d1fmls7typ7h	cmr5fjihw000vqs55y8i87kv5	\N	/api/external/addUser	{"token": "5aab54f00a677a98ac90a413d0ce9eae", "account": "rad_3985", "agent_id": "37220", "login_pwd": "#Joker786", "timestamp": "1783443006263"}	{"msg": "Token expired", "code": 4, "data": [], "count": 0}	4	Token Expired	\N	2026-07-07 11:20:06.34
cmravx3o20027d1fmf06qdh4q	cmr5fjihw000vqs55y8i87kv5	\N	/api/external/addUser	{"token": "634ab18bbc9a3bd8ee572b853ac1c586", "account": "rad_3985", "agent_id": "37220", "login_pwd": "#Joker786", "timestamp": "1783443007"}	{"msg": "Success", "code": 0, "data": {"user_id": "15305663", "account_name": "rad_3985"}, "count": 0}	200	\N	\N	2026-07-07 11:20:07.442
cmraw3hv3002nd1fmg6oyr93p	cmr69xaxy0000yfqf0lk4ujmo	\N	/api/external/addUser	{"token": "d05562e7999ecbe8f990635f84a55b08", "account": "rad", "agent_id": "178114", "login_pwd": "Default123!", "timestamp": "1783443305"}	{"msg": "Account name already exists", "code": 20, "data": [], "count": 0}	20	Username Already Exists	\N	2026-07-07 11:25:05.775
cmraw3iq8002pd1fm577fdeo2	cmr69xaxy0000yfqf0lk4ujmo	\N	/api/external/addUser	{"token": "32af0bd6958c680c6aeed0e3cb436869", "account": "rad_5765", "agent_id": "178114", "login_pwd": "Default123!", "timestamp": "1783443306"}	{"msg": "Success", "code": 0, "data": {"user_id": "15305688", "account_name": "rad_5765"}, "count": 0}	200	\N	\N	2026-07-07 11:25:06.896
cmraw7st9002vd1fma6hwa34v	cmr69xaxy0000yfqf0lk4ujmo	15305688	/api/external/userBalance	{"token": "8f10cec51dcef7c6cbf45ecee2a1cf7a", "user_id": "15305688", "agent_id": "178114", "timestamp": "1783443505"}	{"msg": "Success", "code": 0, "data": {"user_balance": "0"}, "count": 0}	200	\N	\N	2026-07-07 11:28:25.523
cmrawk2jw0036d1fmld6zlu4e	cmr69xaxy0000yfqf0lk4ujmo	15305688	/api/external/userBalance	{"token": "4c8adcf71e5f4b7f655fec60305de605", "user_id": "15305688", "agent_id": "178114", "timestamp": "1783444078"}	{"msg": "Success", "code": 0, "data": {"user_balance": "0"}, "count": 0}	200	\N	\N	2026-07-07 11:37:59.084
cmrawlq3x0038d1fm5l7sq71g	cmr69xaxy0000yfqf0lk4ujmo	15305688	/api/external/playerOffline	{"token": "817979e4b5174a9cecd738d37a517ede", "user_id": "15305688", "agent_id": "178114", "timestamp": "1783444156"}	{"msg": "Success", "code": 0, "data": null, "count": 0}	200	\N	\N	2026-07-07 11:39:16.269
cmrawlvwy003cd1fmsewa6yc1	cmr69xaxy0000yfqf0lk4ujmo	15305688	/api/external/recharge	{"token": "e72ba534ffd5fa50cc7ea216f805d95f", "amount": "6.5", "user_id": "15305688", "agent_id": "178114", "order_id": "TX_1783444159808_mtyf7", "timestamp": "1783444163"}	{"msg": "Success", "code": 0, "data": {"amount": "6.5", "pay_order_id": "TX_1783444159808_mtyf7", "user_balance": "6.5", "agent_balance": "993.55", "transaction_id": "1783444163940305", "transaction_time": "1783444163"}, "count": 0}	200	\N	\N	2026-07-07 11:39:23.794
cmrawm1h7003gd1fmclbt8z73	cmr69xaxy0000yfqf0lk4ujmo	15305688	/api/external/userBalance	{"token": "d1bb0ef108ccff71c841381e5460f397", "user_id": "15305688", "agent_id": "178114", "timestamp": "1783444170"}	{"msg": "Success", "code": 0, "data": {"user_balance": "6.5"}, "count": 0}	200	\N	\N	2026-07-07 11:39:31.003
cmrawpa97003id1fm2m42a2p3	cmr69xaxy0000yfqf0lk4ujmo	15305688	/api/external/userBalance	{"token": "adf9a4c3d792c243f31b484f440fc8fa", "user_id": "15305688", "agent_id": "178114", "timestamp": "1783444322"}	{"msg": "Success", "code": 0, "data": {"user_balance": "4.1"}, "count": 0}	200	\N	\N	2026-07-07 11:42:02.347
cmraxva7h003rd1fmj6ngt0ag	cmr7lwt20002rnggfbn8d7kil	\N	/api/external/addUser	{"token": "5c728ef2318ea692d0a5ed82493da4f2", "account": "rad", "agent_id": "122030", "login_pwd": "Default123!", "timestamp": "1783446281597"}	{"msg": "Token expired", "code": 4, "data": [], "count": 0}	4	Token Expired	\N	2026-07-07 12:14:41.837
cmraxvb08003td1fme4euo7n5	cmr7lwt20002rnggfbn8d7kil	\N	/api/external/addUser	{"token": "652ee1f867794ccb9b4d42951771df40", "account": "rad", "agent_id": "122030", "login_pwd": "Default123!", "timestamp": "1783446282"}	{"msg": "Success", "code": 0, "data": {"user_id": "16787623", "account_name": "rad"}, "count": 0}	200	\N	\N	2026-07-07 12:14:42.872
cmray8zjx004bd1fm6ntctzkk	cmr7lwt20002rnggfbn8d7kil	16787623	/api/external/userBalance	{"token": "4a6edb25ead6673dc27fd5ee5dd99b7c", "user_id": "16787623", "agent_id": "122030", "timestamp": "1783446921"}	{"msg": "Success", "code": 0, "data": {"user_balance": "0"}, "count": 0}	200	\N	\N	2026-07-07 12:25:21.214
cmray9hko004dd1fmr1q8mt34	cmr7lwt20002rnggfbn8d7kil	16787623	/api/external/playerOffline	{"token": "28f8341cfba6a842388273ca8d48713d", "user_id": "16787623", "agent_id": "122030", "timestamp": "1783446944"}	{"msg": "Success", "code": 0, "data": null, "count": 0}	200	\N	\N	2026-07-07 12:25:44.568
cmray9nid004hd1fmqc1oq3b2	cmr7lwt20002rnggfbn8d7kil	16787623	/api/external/recharge	{"token": "12487760f26c7592282f2234a278c321", "amount": "65", "user_id": "16787623", "agent_id": "122030", "order_id": "TX_1783446948194_xouyk", "timestamp": "1783446952"}	{"msg": "Success", "code": 0, "data": {"amount": "65", "pay_order_id": "TX_1783446948194_xouyk", "user_balance": "65", "agent_balance": "935", "transaction_id": "1783446952831677", "transaction_time": "1783446952"}, "count": 0}	200	\N	\N	2026-07-07 12:25:52.261
cmrgynprh0003z6o5scpyzyv8	cmr69xaxy0000yfqf0lk4ujmo	15290343	/api/external/userBalance	{"user_id": "15290343"}	"read ECONNRESET"	500	read ECONNRESET	\N	2026-07-11 22:53:25.421
cmray9tii004ld1fm7p1ki3os	cmr7lwt20002rnggfbn8d7kil	16787623	/api/external/userBalance	{"token": "b1b233e4bccf832b7f0a18b33b2662cc", "user_id": "16787623", "agent_id": "122030", "timestamp": "1783446959"}	{"msg": "Success", "code": 0, "data": {"user_balance": "65"}, "count": 0}	200	\N	\N	2026-07-07 12:26:00.042
cmrayabxd004nd1fm54o3b2az	cmr69xaxy0000yfqf0lk4ujmo	15290343	/api/external/userBalance	{"token": "42b70ed2a813b3030e889487fe218e0c", "user_id": "15290343", "agent_id": "178114", "timestamp": "1783446983"}	{"msg": "Success", "code": 0, "data": {"user_balance": "0"}, "count": 0}	200	\N	\N	2026-07-07 12:26:23.714
cmrazit1a004td1fm1g4y2zi0	cmr69xaxy0000yfqf0lk4ujmo	15305688	/api/external/userBalance	{"token": "fcbb9f441283eca27b29750709678f1d", "user_id": "15305688", "agent_id": "178114", "timestamp": "1783449058"}	{"msg": "Success", "code": 0, "data": {"user_balance": "4.1"}, "count": 0}	200	\N	\N	2026-07-07 13:00:58.943
cmrbtcc8t004xd1fmk424pft5	cmr69xaxy0000yfqf0lk4ujmo	15290343	/api/external/userBalance	{"token": "281b69c98b56ec5a715531abb44b4f07", "user_id": "15290343", "agent_id": "178114", "timestamp": "1783499145"}	{"msg": "Success", "code": 0, "data": {"user_balance": "0"}, "count": 0}	200	\N	\N	2026-07-08 02:55:45.725
cmrbvkxnv0001l2afk3tqyw3d	cmr69xaxy0000yfqf0lk4ujmo	15279483	/api/external/userBalance	{"token": "02a2cfb03cef1f0b23cc7eb60a87851c", "user_id": "15279483", "agent_id": "178114", "timestamp": "1783502905792"}	{"msg": "Token expired", "code": 4, "data": [], "count": 0}	4	Token Expired	\N	2026-07-08 03:58:25.964
cmrbvkygq0003l2afw9gpph7c	cmr69xaxy0000yfqf0lk4ujmo	15279483	/api/external/userBalance	{"token": "56e39068edeac0631f98dc053006479d", "user_id": "15279483", "agent_id": "178114", "timestamp": "1783502906"}	{"msg": "Success", "code": 0, "data": {"user_balance": "0"}, "count": 0}	200	\N	\N	2026-07-08 03:58:27.002
cmrbvl4ze0005l2afa2m134kk	cmr69xaxy0000yfqf0lk4ujmo	15279483	/api/external/userBalance	{"token": "0e838cf2f6ebef2e18b8da62257bc681", "user_id": "15279483", "agent_id": "178114", "timestamp": "1783502914"}	{"msg": "Success", "code": 0, "data": {"user_balance": "0"}, "count": 0}	200	\N	\N	2026-07-08 03:58:34.511
cmrbvmdbw0007l2afmxst9st2	cmr69xaxy0000yfqf0lk4ujmo	15279483	/api/external/userBalance	{"token": "0e89487895c1bc347a83ce27f54babfd", "user_id": "15279483", "agent_id": "178114", "timestamp": "1783502972"}	{"msg": "Success", "code": 0, "data": {"user_balance": "0"}, "count": 0}	200	\N	\N	2026-07-08 03:59:32.925
cmrbvmu2h0009l2afiro329ft	cmr69xaxy0000yfqf0lk4ujmo	15279483	/api/external/userBalance	{"token": "b1549e2d778a3c5d3dbc22370b880218", "user_id": "15279483", "agent_id": "178114", "timestamp": "1783502993"}	{"msg": "Success", "code": 0, "data": {"user_balance": "5"}, "count": 0}	200	\N	\N	2026-07-08 03:59:53.217
cmrbwz1du000bl2af1u8c7j9c	cmr69xaxy0000yfqf0lk4ujmo	15279483	/api/external/userBalance	{"token": "7b1bf6febe69821ec2eb2f63410d04ed", "user_id": "15279483", "agent_id": "178114", "timestamp": "1783505243"}	{"msg": "Success", "code": 0, "data": {"user_balance": "0"}, "count": 0}	200	\N	\N	2026-07-08 04:37:23.587
cmre46l4o0014zv5iko6e46c6	cmr5fjihw000vqs55y8i87kv5	15305663	/api/external/userBalance	{"token": "825f7bde9903cbe2261a799ccfcaf0e0", "user_id": "15305663", "agent_id": "37220", "timestamp": "1783638285061"}	{"msg": "Token expired", "code": 4, "data": [], "count": 0}	4	Token Expired	\N	2026-07-09 17:34:45.432
cmre46lyf0016zv5ij3g1eg3h	cmr5fjihw000vqs55y8i87kv5	15305663	/api/external/userBalance	{"token": "2927f627b192ec65cbd433f2dda9cda8", "user_id": "15305663", "agent_id": "37220", "timestamp": "1783638286"}	{"msg": "Success", "code": 0, "data": {"user_balance": "0"}, "count": 0}	200	\N	\N	2026-07-09 17:34:46.503
cmre46zk60018zv5iov10ouq9	cmr5fjihw000vqs55y8i87kv5	15305663	/api/external/playerOffline	{"token": "ba31db711adf7ec9f179cd9658b86e68", "user_id": "15305663", "agent_id": "37220", "timestamp": "1783638304"}	{"msg": "Success", "code": 0, "data": null, "count": 0}	200	\N	\N	2026-07-09 17:35:04.134
cmre472nm001czv5i1kufpsnd	cmr5fjihw000vqs55y8i87kv5	15305663	/api/external/recharge	{"token": "bb3e33697338435ae87f26f76792d500", "amount": "2.6", "user_id": "15305663", "agent_id": "37220", "order_id": "TX_1783638305104_217kt", "timestamp": "1783638308"}	{"msg": "Success", "code": 0, "data": {"amount": "2.6", "pay_order_id": "TX_1783638305104_217kt", "user_balance": "2.6", "agent_balance": "1108.95", "transaction_id": "1783638308961726", "transaction_time": "1783638308"}, "count": 0}	200	\N	\N	2026-07-09 17:35:08.146
cmre47691001gzv5iek0d7nzz	cmr5fjihw000vqs55y8i87kv5	15305663	/api/external/userBalance	{"token": "7f33ac671581b19642ed77226e263212", "user_id": "15305663", "agent_id": "37220", "timestamp": "1783638311"}	{"msg": "Success", "code": 0, "data": {"user_balance": "2.6"}, "count": 0}	200	\N	\N	2026-07-09 17:35:11.849
cmre49aff001izv5iom0czsqs	cmr5fjihw000vqs55y8i87kv5	15305663	/api/external/userBalance	{"token": "b3a9a506d427313169b0453d559c3b5a", "user_id": "15305663", "agent_id": "37220", "timestamp": "1783638411"}	{"msg": "Success", "code": 0, "data": {"user_balance": "2.6"}, "count": 0}	200	\N	\N	2026-07-09 17:36:51.532
cmrgttyut0006cyz8045a725z	cmr5fjihw000vqs55y8i87kv5	\N	/api/external/getUserID	{"token": "fdf321af0d497518515563864f9097e7", "agent_id": "37220", "timestamp": "1783802298751", "account_name": "player"}	{"msg": "Token expired", "code": 4, "data": [], "count": 0}	4	Token Expired	\N	2026-07-11 15:08:19.061
cmrgttz620008cyz8luoesmb6	cmr5fjihw000vqs55y8i87kv5	\N	/api/external/getUserID	{"token": "0b6fef6ad029c984db1d735a198e3fea", "agent_id": "37220", "timestamp": "1783802299390", "account_name": "player001"}	{"msg": "Token expired", "code": 4, "data": [], "count": 0}	4	Token Expired	\N	2026-07-11 15:08:19.467
cmrgttzp5000acyz84er7d29w	cmr5fjihw000vqs55y8i87kv5	\N	/api/external/getUserID	{"token": "69378d49518664960efe649a705a4689", "agent_id": "37220", "timestamp": "1783802300", "account_name": "player"}	{"msg": "Invalid user ID", "code": 8, "data": [], "count": 0}	8	Invalid User ID	\N	2026-07-11 15:08:20.153
cmrgttzza000ccyz8dmiiv8z9	cmr5fjihw000vqs55y8i87kv5	\N	/api/external/getUserID	{"token": "69378d49518664960efe649a705a4689", "agent_id": "37220", "timestamp": "1783802300", "account_name": "player001"}	{"msg": "Invalid user ID", "code": 8, "data": [], "count": 0}	8	Invalid User ID	\N	2026-07-11 15:08:20.519
cmrgtuyco000hcyz83sefu4j5	cmr5fjihw000vqs55y8i87kv5	\N	/api/external/addUser	{"token": "3c441aa806890dd1bb1954acf0b9c480", "account": "player001", "agent_id": "37220", "login_pwd": "Jammy@321", "timestamp": "1783802344947"}	{"msg": "Token expired", "code": 4, "data": [], "count": 0}	4	Token Expired	\N	2026-07-11 15:09:05.064
cmshcynp00007cfh1i1ezp15f	cmsfvgxvr00087y6fy1hmp5x7	\N	/api/external/agentBalance	{"token": "65e37efaae4be530fe166535f3eb90e7", "agent_id": "Gamora123", "timestamp": "1786011211019"}	""	200	\N	\N	2026-08-06 10:13:32.916
cmrgtuz5u000jcyz88j8w42bx	cmr5fjihw000vqs55y8i87kv5	\N	/api/external/addUser	{"token": "661770cb8e95d81721d0300b05004abb", "account": "player001", "agent_id": "37220", "login_pwd": "Jammy@321", "timestamp": "1783802346"}	{"msg": "Account name already exists", "code": 20, "data": [], "count": 0}	20	Username Already Exists	\N	2026-07-11 15:09:06.114
cmrgtuzz1000lcyz8xkvhfyq2	cmr5fjihw000vqs55y8i87kv5	\N	/api/external/addUser	{"token": "b0e9be22afc45c0cd33116e7e151c256", "account": "player001_4007", "agent_id": "37220", "login_pwd": "Jammy@321", "timestamp": "1783802347093"}	{"msg": "Token expired", "code": 4, "data": [], "count": 0}	4	Token Expired	\N	2026-07-11 15:09:07.166
cmrgtv0td000ncyz8drumr1mo	cmr5fjihw000vqs55y8i87kv5	\N	/api/external/addUser	{"token": "af6e9eb908e72f26a0aef4804dd02c8a", "account": "player001_4007", "agent_id": "37220", "login_pwd": "Jammy@321", "timestamp": "1783802348"}	{"msg": "Success", "code": 0, "data": {"user_id": "15355882", "account_name": "player001_4007"}, "count": 0}	200	\N	\N	2026-07-11 15:09:08.257
cmrgvge370010cyz89biwm8fw	cmr5fjihw000vqs55y8i87kv5	15355882	/api/external/userBalance	{"token": "7f5fed9985388520468a744f3b20da01", "user_id": "15355882", "agent_id": "37220", "timestamp": "1783805024"}	{"msg": "Success", "code": 0, "data": {"user_balance": "0"}, "count": 0}	200	\N	\N	2026-07-11 15:53:44.851
cmrgvgtje0012cyz8lj8kcrai	cmr69xaxy0000yfqf0lk4ujmo	\N	/api/external/addUser	{"token": "a57b6029f90b0e98e7899b724fb0721d", "account": "player001", "agent_id": "178114", "login_pwd": "Default123!", "timestamp": "1783805044679"}	{"msg": "Token expired", "code": 4, "data": [], "count": 0}	4	Token Expired	\N	2026-07-11 15:54:04.874
cmrgvgucm0014cyz8qkvgra57	cmr69xaxy0000yfqf0lk4ujmo	\N	/api/external/addUser	{"token": "a5dde454925798f20f7deab421589aa0", "account": "player001", "agent_id": "178114", "login_pwd": "Default123!", "timestamp": "1783805045"}	{"msg": "Account name already exists", "code": 20, "data": [], "count": 0}	20	Username Already Exists	\N	2026-07-11 15:54:05.926
cmrgvgv5l0016cyz84cz3rsk2	cmr69xaxy0000yfqf0lk4ujmo	\N	/api/external/addUser	{"token": "28f38d9cfb6b4ee15d6c40ffc83e0990", "account": "player001_2967", "agent_id": "178114", "login_pwd": "Default123!", "timestamp": "1783805046894"}	{"msg": "Token expired", "code": 4, "data": [], "count": 0}	4	Token Expired	\N	2026-07-11 15:54:06.969
cmrgvgvyp0018cyz8wfeix7zi	cmr69xaxy0000yfqf0lk4ujmo	\N	/api/external/addUser	{"token": "e982cfa9d7fb88868b7f205bc52dc95e", "account": "player001_2967", "agent_id": "178114", "login_pwd": "Default123!", "timestamp": "1783805047"}	{"msg": "Success", "code": 0, "data": {"user_id": "15356308", "account_name": "player001_2967"}, "count": 0}	200	\N	\N	2026-07-11 15:54:08.018
cmr69xiwy0002yfqff45q2gmu	cmr69xaxy0000yfqf0lk4ujmo	\N	/api/external/agentBalance	{}	"read ECONNRESET"	500	read ECONNRESET	\N	2026-07-04 05:53:30.946
cmr69xmj00004yfqfbakjw44n	cmr69xaxy0000yfqf0lk4ujmo	\N	/api/external/agentBalance	{}	"read ECONNRESET"	500	read ECONNRESET	\N	2026-07-04 05:53:35.628
cmr6a6bos00012kdicg9flj6d	cmr69xaxy0000yfqf0lk4ujmo	\N	/api/external/agentBalance	{}	"read ECONNRESET"	500	read ECONNRESET	\N	2026-07-04 06:00:21.482
cmr6b4r6e0001mn9s63a16q2u	cmr69xaxy0000yfqf0lk4ujmo	\N	/api/external/getUserID	{"account_name": "annalaurel_pl12"}	"read ECONNRESET"	500	read ECONNRESET	\N	2026-07-04 06:27:07.858
cmr6b51f50006mn9s8ksl51n5	cmr69xaxy0000yfqf0lk4ujmo	\N	/api/external/addUser	{"account": "annalaurel_pl12", "login_pwd": "Jammy@321"}	"read ECONNRESET"	500	read ECONNRESET	\N	2026-07-04 06:27:21.137
cmr7dc6ay0001txqnaksnemu6	cmr69xaxy0000yfqf0lk4ujmo	\N	/api/external/addUser	{"account": "admin", "login_pwd": "Default123!"}	"read ECONNRESET"	500	read ECONNRESET	\N	2026-07-05 00:16:39.463
cmr7mobm5004dnggfy7aqbtos	cmr5ffgpe000mqs55ym8xwjyg	\N	/api/external/agentBalance	{}	"Client network socket disconnected before secure TLS connection was established"	500	Client network socket disconnected before secure TLS connection was established	\N	2026-07-05 04:38:02.765
cmr7mq53c00011bi4s3jsr351	cmr5ffgpe000mqs55ym8xwjyg	\N	/api/external/agentBalance	{}	"Client network socket disconnected before secure TLS connection was established"	500	Client network socket disconnected before secure TLS connection was established	\N	2026-07-05 04:39:27.624
cmr8ub5tw000125m0p353ggon	cmr69xaxy0000yfqf0lk4ujmo	\N	/api/external/addUser	{"account": "admin", "login_pwd": "Default123!"}	"read ECONNRESET"	500	read ECONNRESET	\N	2026-07-06 00:59:31.843
cmr8uk4wr00013h49hopwz1rh	cmr69xaxy0000yfqf0lk4ujmo	\N	/api/external/addUser	{"account": "admin", "login_pwd": "Default123!"}	"read ECONNRESET"	500	read ECONNRESET	\N	2026-07-06 01:06:30.555
cmr8ukkqd00033h49r8ygx5bo	cmr7lwt20002rnggfbn8d7kil	\N	/api/external/addUser	{"account": "admin", "login_pwd": "Default123!"}	"read ECONNRESET"	500	read ECONNRESET	\N	2026-07-06 01:06:51.062
cmr8v7h2800073h4928a66o8n	cmr69xaxy0000yfqf0lk4ujmo	15290343	/api/external/userBalance	{"user_id": "15290343"}	"read ECONNRESET"	500	read ECONNRESET	\N	2026-07-06 01:24:39.393
cmr8v7it200093h497upzdua8	cmr69xaxy0000yfqf0lk4ujmo	15290343	/api/external/userBalance	{"user_id": "15290343"}	"read ECONNRESET"	500	read ECONNRESET	\N	2026-07-06 01:24:41.655
cmr8v86b2000b3h49s32xc4pf	cmr69xaxy0000yfqf0lk4ujmo	15290343	/api/external/userBalance	{"user_id": "15290343"}	"read ECONNRESET"	500	read ECONNRESET	\N	2026-07-06 01:25:12.111
cmr8v87rj000d3h49s033gc0b	cmr69xaxy0000yfqf0lk4ujmo	15290343	/api/external/userBalance	{"user_id": "15290343"}	"read ECONNRESET"	500	read ECONNRESET	\N	2026-07-06 01:25:13.999
cmrbuthie000114owh0ekjg4h	cmr69xaxy0000yfqf0lk4ujmo	15290343	/api/external/userBalance	{"user_id": "15290343"}	"read ECONNRESET"	500	read ECONNRESET	\N	2026-07-08 03:37:05.318
cmrbv5rg300013y6sp3sb46hc	cmr69xaxy0000yfqf0lk4ujmo	15290343	/api/external/userBalance	{"user_id": "15290343"}	"read ECONNRESET"	500	read ECONNRESET	\N	2026-07-08 03:46:38.067
cmrbv6th400033y6sjia9gehe	cmr69xaxy0000yfqf0lk4ujmo	15290343	/api/external/userBalance	{"user_id": "15290343"}	"read ECONNRESET"	500	read ECONNRESET	\N	2026-07-08 03:47:27.352
cmrcclm9t00011uvacnpbkiqy	cmr69xaxy0000yfqf0lk4ujmo	15290343	/api/external/userBalance	{"user_id": "15290343"}	"read ECONNRESET"	500	read ECONNRESET	\N	2026-07-08 11:54:51.327
cmrgsnfvy00017aulz3tp44g4	cmr69xaxy0000yfqf0lk4ujmo	15290343	/api/external/userBalance	{"user_id": "15290343"}	"read ECONNRESET"	500	read ECONNRESET	\N	2026-07-11 14:35:14.926
cmrgt8rxp0003kn7x2z6jngzi	cmr69xaxy0000yfqf0lk4ujmo	15290343	/api/external/userBalance	{"user_id": "15290343"}	"read ECONNRESET"	500	read ECONNRESET	\N	2026-07-11 14:51:50.317
cmrhmisy3000cwtnp33oqg3sb	cmr69xaxy0000yfqf0lk4ujmo	15290343	/api/external/userBalance	{"token": "ec36396bb52fe204cda2a908c43dd19b", "user_id": "15290343", "agent_id": "178114", "timestamp": "1783850486781"}	{"msg": "Token expired", "code": 4, "data": [], "count": 0}	4	Token Expired	\N	2026-07-12 10:01:27.051
cmrhmit80000ewtnp16fe0g6j	cmr69xaxy0000yfqf0lk4ujmo	15290343	/api/external/userBalance	{"token": "f2ca3ee7be1ed1627acb39490a872591", "user_id": "15290343", "agent_id": "178114", "timestamp": "1783850487"}	{"msg": "Success", "code": 0, "data": {"user_balance": "0"}, "count": 0}	200	\N	\N	2026-07-12 10:01:27.409
cmrhmn681000gwtnpn106aufa	cmr69xaxy0000yfqf0lk4ujmo	15277896	/api/external/userBalance	{"token": "c91ad5bc4f9555388123c45e0982e949", "user_id": "15277896", "agent_id": "178114", "timestamp": "1783850690"}	{"msg": "Success", "code": 0, "data": {"user_balance": "0"}, "count": 0}	200	\N	\N	2026-07-12 10:04:50.881
cmrhmnhmc000iwtnpk812ar32	cmr69xaxy0000yfqf0lk4ujmo	15277896	/api/external/userBalance	{"token": "23dedf54b44916353da5ab397f77a280", "user_id": "15277896", "agent_id": "178114", "timestamp": "1783850705"}	{"msg": "Success", "code": 0, "data": {"user_balance": "0"}, "count": 0}	200	\N	\N	2026-07-12 10:05:05.379
cmrhmnvne000mwtnpwourvaxm	cmr7lwt20002rnggfbn8d7kil	\N	/api/external/addUser	{"token": "4b8ec628576bd8cab8a1f950ba765d84", "account": "Laurelanna", "agent_id": "122030", "login_pwd": "Default123!", "timestamp": "1783850723561"}	{"msg": "Token expired", "code": 4, "data": [], "count": 0}	4	Token Expired	\N	2026-07-12 10:05:23.834
cmrhmnvwg000owtnpj1unuv4s	cmr7lwt20002rnggfbn8d7kil	\N	/api/external/addUser	{"token": "02152ff065732b230e37b9c5abd5e498", "account": "Laurelanna", "agent_id": "122030", "login_pwd": "Default123!", "timestamp": "1783850724"}	{"msg": "Success", "code": 0, "data": {"user_id": "16820358", "account_name": "laurelanna"}, "count": 0}	200	\N	\N	2026-07-12 10:05:24.161
cmrhp5wn00001unsxb54u0eyw	cmr69xaxy0000yfqf0lk4ujmo	15290343	/api/external/userBalance	{"token": "170c3d8de997b3ee28c614e6a6f20c03", "user_id": "15290343", "agent_id": "178114", "timestamp": "1783854923785"}	{"msg": "Token expired", "code": 4, "data": [], "count": 0}	4	Token Expired	\N	2026-07-12 11:15:24.156
cmrhp5wx60003unsxqmfcs39x	cmr69xaxy0000yfqf0lk4ujmo	15290343	/api/external/userBalance	{"token": "c74f4570e1643226df9576df5ea63754", "user_id": "15290343", "agent_id": "178114", "timestamp": "1783854924"}	{"msg": "Success", "code": 0, "data": {"user_balance": "0"}, "count": 0}	200	\N	\N	2026-07-12 11:15:24.522
cmrhp60md0005unsxhj0dj6pj	cmr69xaxy0000yfqf0lk4ujmo	15290343	/api/external/playerOffline	{"token": "fafcc590c609a6eb4788833358735add", "user_id": "15290343", "agent_id": "178114", "timestamp": "1783854929"}	{"msg": "Success", "code": 0, "data": null, "count": 0}	200	\N	\N	2026-07-12 11:15:29.317
cmrhp61jm0009unsxoqts4yge	cmr69xaxy0000yfqf0lk4ujmo	15290343	/api/external/recharge	{"token": "363e640837e26321f920b723523f13cc", "amount": "20", "user_id": "15290343", "agent_id": "178114", "order_id": "TX_1783854929594_t48qx", "timestamp": "1783854930"}	{"msg": "Success", "code": 0, "data": {"amount": "20", "pay_order_id": "TX_1783854929594_t48qx", "user_balance": "20", "agent_balance": "973.55", "transaction_id": "1783854930988104", "transaction_time": "1783854930"}, "count": 0}	200	\N	\N	2026-07-12 11:15:30.514
cmrhp62yc000dunsxn4hrroyn	cmr69xaxy0000yfqf0lk4ujmo	15290343	/api/external/userBalance	{"token": "c56973d0f586248f43a28a7b29254161", "user_id": "15290343", "agent_id": "178114", "timestamp": "1783854932"}	{"msg": "Success", "code": 0, "data": {"user_balance": "20"}, "count": 0}	200	\N	\N	2026-07-12 11:15:32.128
cmrhp676s000funsxt482q1mm	cmr69xaxy0000yfqf0lk4ujmo	15290343	/api/external/userBalance	{"token": "b70cb5a87f12c5cfdf7fce0fe8bcdbe1", "user_id": "15290343", "agent_id": "178114", "timestamp": "1783854937"}	{"msg": "Success", "code": 0, "data": {"user_balance": "20"}, "count": 0}	200	\N	\N	2026-07-12 11:15:37.773
cmrhp713y000hunsxlcvt0jjw	cmr7lwt20002rnggfbn8d7kil	\N	/api/external/addUser	{"token": "3020386952f3f459514c9fdbb7671d33", "account": "admin", "agent_id": "122030", "login_pwd": "Default123!", "timestamp": "1783854976451"}	{"msg": "Token expired", "code": 4, "data": [], "count": 0}	4	Token Expired	\N	2026-07-12 11:16:16.606
cmrhp71cq000junsx3e43j4tm	cmr7lwt20002rnggfbn8d7kil	\N	/api/external/addUser	{"token": "47779f41ba93ba22ddbda9eab520f808", "account": "admin", "agent_id": "122030", "login_pwd": "Default123!", "timestamp": "1783854976"}	{"msg": "Account name already exists", "code": 20, "data": [], "count": 0}	20	Username Already Exists	\N	2026-07-12 11:16:16.922
cmrhp71lg000lunsxmiw4ws7s	cmr7lwt20002rnggfbn8d7kil	\N	/api/external/addUser	{"token": "34e8311c78fe45e5281ee7169a09d552", "account": "admin_6741", "agent_id": "122030", "login_pwd": "Default123!", "timestamp": "1783854977193"}	{"msg": "Token expired", "code": 4, "data": [], "count": 0}	4	Token Expired	\N	2026-07-12 11:16:17.235
cmrhp71uc000nunsxlf799rot	cmr7lwt20002rnggfbn8d7kil	\N	/api/external/addUser	{"token": "2b50739ef663026b4f1aabfe1f7642bf", "account": "admin_6741", "agent_id": "122030", "login_pwd": "Default123!", "timestamp": "1783854977"}	{"msg": "Success", "code": 0, "data": {"user_id": "16820892", "account_name": "admin_6741"}, "count": 0}	200	\N	\N	2026-07-12 11:16:17.557
cmrhp77ar000runsx6hlpl9dg	cmr7lwt20002rnggfbn8d7kil	16820892	/api/external/playerOffline	{"token": "1e63d5f096a226490139e45a31b05fd0", "user_id": "16820892", "agent_id": "122030", "timestamp": "1783854984"}	{"msg": "Success", "code": 0, "data": null, "count": 0}	200	\N	\N	2026-07-12 11:16:24.627
cmrhp78aj000vunsxmh9bj8w2	cmr7lwt20002rnggfbn8d7kil	16820892	/api/external/recharge	{"token": "1d47a096a9ddbd28231a55b4e5406632", "amount": "13", "user_id": "16820892", "agent_id": "122030", "order_id": "TX_1783854984905_u879s", "timestamp": "1783854985"}	{"msg": "Success", "code": 0, "data": {"amount": "13", "pay_order_id": "TX_1783854984905_u879s", "user_balance": "13", "agent_balance": "922", "transaction_id": "1783854985875286", "transaction_time": "1783854985"}, "count": 0}	200	\N	\N	2026-07-12 11:16:25.915
cmrhp79og000zunsxnhjfwop4	cmr7lwt20002rnggfbn8d7kil	16820892	/api/external/userBalance	{"token": "15b92577e661361a2b2f86c6cf80dfe5", "user_id": "16820892", "agent_id": "122030", "timestamp": "1783854987"}	{"msg": "Success", "code": 0, "data": {"user_balance": "13"}, "count": 0}	200	\N	\N	2026-07-12 11:16:27.473
cmrhp8f3r0011unsxld0yv88p	cmr7lwt20002rnggfbn8d7kil	16820892	/api/external/userBalance	{"token": "b63a04ad379866c304b06040adca0b28", "user_id": "16820892", "agent_id": "122030", "timestamp": "1783855040"}	{"msg": "Success", "code": 0, "data": {"user_balance": "13"}, "count": 0}	200	\N	\N	2026-07-12 11:17:21.041
cmrhp8kuc0013unsxhv2swt3z	cmr69xaxy0000yfqf0lk4ujmo	15290343	/api/external/userBalance	{"token": "e74f16a8e97a3c36278cc33f8f8458ca", "user_id": "15290343", "agent_id": "178114", "timestamp": "1783855048"}	{"msg": "Success", "code": 0, "data": {"user_balance": "0"}, "count": 0}	200	\N	\N	2026-07-12 11:17:28.836
cmrhp9kig0019unsx8n6i7lvp	cmr7lwt20002rnggfbn8d7kil	16820892	/api/external/userBalance	{"token": "8b7e147aa710962340d70e4bb379bffa", "user_id": "16820892", "agent_id": "122030", "timestamp": "1783855094"}	{"msg": "Success", "code": 0, "data": {"user_balance": "0"}, "count": 0}	200	\N	\N	2026-07-12 11:18:14.782
cmrhp8ma50015unsx45uyqkaq	cmr69xaxy0000yfqf0lk4ujmo	15290343	/api/external/userBalance	{"token": "dc70b3d58f15854ee8d690a50ffe8c93", "user_id": "15290343", "agent_id": "178114", "timestamp": "1783855050"}	{"msg": "Success", "code": 0, "data": {"user_balance": "0"}, "count": 0}	200	\N	\N	2026-07-12 11:17:30.701
cmrhp926m0017unsxmmqgzjan	cmr7lwt20002rnggfbn8d7kil	16820892	/api/external/userBalance	{"token": "8a07728b582e6c8cc9761f1637b1dc2b", "user_id": "16820892", "agent_id": "122030", "timestamp": "1783855071"}	{"msg": "Success", "code": 0, "data": {"user_balance": "13"}, "count": 0}	200	\N	\N	2026-07-12 11:17:51.31
cmrjm3gwl000912i31kcibowf	cmr7lwt20002rnggfbn8d7kil	16820358	/api/external/userBalance	{"token": "81cff8c3bdf27efb1616cc03457d0a7a", "user_id": "16820358", "agent_id": "122030", "timestamp": "1783970703784"}	{"msg": "Token expired", "code": 4, "data": [], "count": 0}	4	Token Expired	\N	2026-07-13 19:25:03.957
cmrjm3h6d000b12i32bx8705t	cmr7lwt20002rnggfbn8d7kil	16820358	/api/external/userBalance	{"token": "d3dbc787ccdc61638da6c337d7a83d90", "user_id": "16820358", "agent_id": "122030", "timestamp": "1783970704"}	{"msg": "Success", "code": 0, "data": {"user_balance": "0"}, "count": 0}	200	\N	\N	2026-07-13 19:25:04.309
cmrku0owf0001ewlsyakbxohb	cmr5fjihw000vqs55y8i87kv5	15305663	/api/external/userBalance	{"token": "afb33c0c1cdd5ee4571a385d70b12868", "user_id": "15305663", "agent_id": "37220", "timestamp": "1784044477121"}	{"msg": "Token expired", "code": 4, "data": [], "count": 0}	4	Token Expired	\N	2026-07-14 15:54:37.455
cmrku0pcm0003ewls90kepzhd	cmr5fjihw000vqs55y8i87kv5	15305663	/api/external/userBalance	{"token": "b9add23665efe39e9e96312a73102468", "user_id": "15305663", "agent_id": "37220", "timestamp": "1784044477"}	{"msg": "Success", "code": 0, "data": {"user_balance": "2.6"}, "count": 0}	200	\N	\N	2026-07-14 15:54:37.848
cmrkual6i0007ewls1rsgs1qr	cmr69xaxy0000yfqf0lk4ujmo	15305688	/api/external/userBalance	{"token": "c6395049871f15e7a85d5773b45e8827", "user_id": "15305688", "agent_id": "178114", "timestamp": "1784044938825"}	{"msg": "Token expired", "code": 4, "data": [], "count": 0}	4	Token Expired	\N	2026-07-14 16:02:19.195
cmrkualgd0009ewlspign7jiq	cmr69xaxy0000yfqf0lk4ujmo	15305688	/api/external/userBalance	{"token": "e2b8b46eb068a9d8b11983d2689f9f40", "user_id": "15305688", "agent_id": "178114", "timestamp": "1784044939"}	{"msg": "Success", "code": 0, "data": {"user_balance": "4.1"}, "count": 0}	200	\N	\N	2026-07-14 16:02:19.549
cmrl914f9000bewlscc5d0en7	cmr5fjihw000vqs55y8i87kv5	\N	/api/external/getUserID	{"token": "bc845f104e4a8ffaecb917b027b8e1a8", "agent_id": "37220", "timestamp": "1784069691", "account_name": "xxOTZDjmSxHQCBOGXn"}	{"msg": "Invalid user ID", "code": 8, "data": [], "count": 0}	8	Invalid User ID	\N	2026-07-14 22:54:51.813
cmrl919av000gewlslwcmnlt9	cmr5fjihw000vqs55y8i87kv5	\N	/api/external/addUser	{"token": "3b92644a0cccf579efea19ee69f1d223", "account": "xxOTZDjmSxHQCBOGXn", "agent_id": "37220", "login_pwd": "auhzbjzvN1dPVAa1!", "timestamp": "1784069697"}	{"msg": "Success", "code": 0, "data": {"user_id": "15394699", "account_name": "xxotzdjmsxhqcbogxn"}, "count": 0}	200	\N	\N	2026-07-14 22:54:58.135
cmrlrjj2k00015qf3m3bhf2y6	cmr69xaxy0000yfqf0lk4ujmo	15305688	/api/external/userBalance	{"token": "1d49d5ce08cd14c4b638f5fd64536e46", "user_id": "15305688", "agent_id": "178114", "timestamp": "1784100783334"}	{"msg": "Token expired", "code": 4, "data": [], "count": 0}	4	Token Expired	\N	2026-07-15 07:33:03.693
cmrlrjjct00035qf3yg2y2twf	cmr69xaxy0000yfqf0lk4ujmo	15305688	/api/external/userBalance	{"token": "d48ce73ceb585f5867b4d9fa7bf45d7a", "user_id": "15305688", "agent_id": "178114", "timestamp": "1784100783"}	{"msg": "Success", "code": 0, "data": {"user_balance": "4.1"}, "count": 0}	200	\N	\N	2026-07-15 07:33:04.062
cmrqzvhqa000a6ihjkog84d8y	cmr5fjihw000vqs55y8i87kv5	\N	/api/external/addUser	{"token": "7ea29e839a3b89d3fe2af39530cfec9c", "account": "jolenepreze23", "agent_id": "37220", "login_pwd": "Jammy@321", "timestamp": "1784417108120"}	{"msg": "Token expired", "code": 4, "data": [], "count": 0}	4	Token Expired	\N	2026-07-18 23:25:09.373
cmrqzvj1m000c6ihj30a09fld	cmr5fjihw000vqs55y8i87kv5	\N	/api/external/addUser	{"token": "464a7eeaf1770c4f42176b3e6f190d4c", "account": "jolenepreze23", "agent_id": "37220", "login_pwd": "Jammy@321", "timestamp": "1784417110"}	{"msg": "Access ip is not white ip", "code": 5, "data": [], "count": 0}	5	Access IP Not Whitelisted	\N	2026-07-18 23:25:11.338
cmrqzymxp000i6ihjnmvblcif	cmr69xaxy0000yfqf0lk4ujmo	15279483	/api/external/userBalance	{"user_id": "15279483"}	"read ECONNRESET"	500	read ECONNRESET	\N	2026-07-18 23:27:36.349
cmrqzyy04000k6ihjs1w2g1o6	cmr69xaxy0000yfqf0lk4ujmo	15279483	/api/external/playerOffline	{"user_id": "15279483"}	"read ECONNRESET"	500	read ECONNRESET	\N	2026-07-18 23:27:50.692
cmrqzz1qj000o6ihjwtoyicu2	cmr69xaxy0000yfqf0lk4ujmo	15279483	/api/external/recharge	{"amount": "6.5", "user_id": "15279483", "order_id": "TX_1784417272147_4q73g"}	"read ECONNRESET"	500	read ECONNRESET	\N	2026-07-18 23:27:55.531
cmrqzzaw6000q6ihjzh6ilw39	cmr69xaxy0000yfqf0lk4ujmo	15279483	/api/external/userBalance	{"user_id": "15279483"}	"read ECONNRESET"	500	read ECONNRESET	\N	2026-07-18 23:28:07.137
cmrr00bay000s6ihjzvx7ddhf	cmr69xaxy0000yfqf0lk4ujmo	15279483	/api/external/userBalance	{"user_id": "15279483"}	"read ECONNRESET"	500	read ECONNRESET	\N	2026-07-18 23:28:54.587
cmrr00gkv000u6ihjbttr9602	cmr69xaxy0000yfqf0lk4ujmo	15279483	/api/external/userBalance	{"user_id": "15279483"}	"read ECONNRESET"	500	read ECONNRESET	\N	2026-07-18 23:29:01.423
cmrr00y80000w6ihjftk5yltc	cmr69xaxy0000yfqf0lk4ujmo	15279483	/api/external/userBalance	{"user_id": "15279483"}	"read ECONNRESET"	500	read ECONNRESET	\N	2026-07-18 23:29:24.288
cmrr014pz000y6ihjm5v9mbdn	cmr69xaxy0000yfqf0lk4ujmo	15279483	/api/external/userBalance	{"user_id": "15279483"}	"read ECONNRESET"	500	read ECONNRESET	\N	2026-07-18 23:29:32.712
cmrr01ghn00106ihj8jhrcxfv	cmr69xaxy0000yfqf0lk4ujmo	15279483	/api/external/userBalance	{"user_id": "15279483"}	"read ECONNRESET"	500	read ECONNRESET	\N	2026-07-18 23:29:47.665
cmrr03q8u00012mg5d691r0j5	cmr69xaxy0000yfqf0lk4ujmo	15290343	/api/external/userBalance	{"token": "258ac99cbf0e267af8a8e41cd3fe1186", "user_id": "15290343", "agent_id": "178114", "timestamp": "1784417493729"}	{"msg": "Token expired", "code": 4, "data": [], "count": 0}	4	Token Expired	\N	2026-07-18 23:31:33.918
cmrr03qif00032mg5b9mv6z6h	cmr69xaxy0000yfqf0lk4ujmo	15290343	/api/external/userBalance	{"token": "b45eb24e2f3efbf3dcb0a772fa4d83b9", "user_id": "15290343", "agent_id": "178114", "timestamp": "1784417494"}	{"msg": "Success", "code": 0, "data": {"user_balance": "0"}, "count": 0}	200	\N	\N	2026-07-18 23:31:34.263
cmrr0461e00052mg58x13xy3z	cmr69xaxy0000yfqf0lk4ujmo	15290343	/api/external/userBalance	{"token": "768b03e8b6f0e2001d3c987414d6402c", "user_id": "15290343", "agent_id": "178114", "timestamp": "1784417514"}	{"msg": "Success", "code": 0, "data": {"user_balance": "5"}, "count": 0}	200	\N	\N	2026-07-18 23:31:54.135
cmrr0hknd00072mg5kegetam5	cmr69xaxy0000yfqf0lk4ujmo	15290343	/api/external/userBalance	{"token": "42322730a2e8d46cdccac147019a81bf", "user_id": "15290343", "agent_id": "178114", "timestamp": "1784418139"}	{"msg": "Success", "code": 0, "data": {"user_balance": "0"}, "count": 0}	200	\N	\N	2026-07-18 23:42:19.849
cmrr1nnnp000310ff1bz87hc2	cmr69xaxy0000yfqf0lk4ujmo	15279483	/api/external/userBalance	{"token": "cfe152d176be85bafb4695f98bfd2175", "user_id": "15279483", "agent_id": "178114", "timestamp": "1784420102891"}	{"msg": "Token expired", "code": 4, "data": [], "count": 0}	4	Token Expired	\N	2026-07-19 00:15:03.301
cmrr1nnxq000510ffbt2t5v70	cmr69xaxy0000yfqf0lk4ujmo	15279483	/api/external/userBalance	{"token": "e205e8831e9d5e162f2e2d55ef9e09bd", "user_id": "15279483", "agent_id": "178114", "timestamp": "1784420103"}	{"msg": "Success", "code": 0, "data": {"user_balance": "0"}, "count": 0}	200	\N	\N	2026-07-19 00:15:03.662
cmrr1nsqs000710ffuuejippf	cmr69xaxy0000yfqf0lk4ujmo	15279483	/api/external/userBalance	{"token": "d0b99151a36325f690ce85f9488d64d5", "user_id": "15279483", "agent_id": "178114", "timestamp": "1784420109"}	{"msg": "Success", "code": 0, "data": {"user_balance": "0"}, "count": 0}	200	\N	\N	2026-07-19 00:15:09.892
cmrr1o3am000910ff0csnsxgg	cmr69xaxy0000yfqf0lk4ujmo	15279483	/api/external/userBalance	{"token": "643737b3d3f2bc807c77b6207ebfaa45", "user_id": "15279483", "agent_id": "178114", "timestamp": "1784420123"}	{"msg": "Success", "code": 0, "data": {"user_balance": "5"}, "count": 0}	200	\N	\N	2026-07-19 00:15:23.141
cmrr1omvz000b10ffoohz2je6	cmr69xaxy0000yfqf0lk4ujmo	15279483	/api/external/userBalance	{"token": "ea50d7ed2fafa82308758758edb8e21c", "user_id": "15279483", "agent_id": "178114", "timestamp": "1784420148"}	{"msg": "Success", "code": 0, "data": {"user_balance": "5"}, "count": 0}	200	\N	\N	2026-07-19 00:15:48.96
cmrr1spmb000f10ffpb27om3e	cmr69xaxy0000yfqf0lk4ujmo	15279483	/api/external/userBalance	{"token": "82002dfca70122514752ca23afad370f", "user_id": "15279483", "agent_id": "178114", "timestamp": "1784420338"}	{"msg": "Success", "code": 0, "data": {"user_balance": "5"}, "count": 0}	200	\N	\N	2026-07-19 00:18:58.778
cmrr28q80000112lgc20mosas	cmr69xaxy0000yfqf0lk4ujmo	15279483	/api/external/userBalance	{"token": "2ffda7ab99de63533b4a84008f47caa4", "user_id": "15279483", "agent_id": "178114", "timestamp": "1784421086190"}	{"msg": "Token expired", "code": 4, "data": [], "count": 0}	4	Token Expired	\N	2026-07-19 00:31:26.4
cmrr28qht000312lg1dirho7x	cmr69xaxy0000yfqf0lk4ujmo	15279483	/api/external/userBalance	{"token": "fae680a192c9daac98dadfd47f215d06", "user_id": "15279483", "agent_id": "178114", "timestamp": "1784421086"}	{"msg": "Success", "code": 0, "data": {"user_balance": "5"}, "count": 0}	200	\N	\N	2026-07-19 00:31:26.754
cmrr296oy000512lg9n4fdw4j	cmr69xaxy0000yfqf0lk4ujmo	15279483	/api/external/userBalance	{"token": "a17e66679274fcf13e3f5509dd75adac", "user_id": "15279483", "agent_id": "178114", "timestamp": "1784421107"}	{"msg": "Success", "code": 0, "data": {"user_balance": "5"}, "count": 0}	200	\N	\N	2026-07-19 00:31:47.501
cmrrszgs90001q5k8rvyctn0l	cmr69xaxy0000yfqf0lk4ujmo	15290343	/api/external/userBalance	{"user_id": "15290343"}	"read ECONNRESET"	500	read ECONNRESET	\N	2026-07-19 13:00:03.894
cmrs1tp8s0007139vdeegdwrm	cmr69xaxy0000yfqf0lk4ujmo	15279483	/api/external/userBalance	{"token": "57174aac2b24d778b9cca0b114f5914b", "user_id": "15279483", "agent_id": "178114", "timestamp": "1784480851144"}	{"msg": "Token expired", "code": 4, "data": [], "count": 0}	4	Token Expired	\N	2026-07-19 17:07:31.468
cmrs1tpil0009139vbekz6xoh	cmr69xaxy0000yfqf0lk4ujmo	15279483	/api/external/userBalance	{"token": "9998632783316e1d2520663c84064c56", "user_id": "15279483", "agent_id": "178114", "timestamp": "1784480851"}	{"msg": "Success", "code": 0, "data": {"user_balance": "5"}, "count": 0}	200	\N	\N	2026-07-19 17:07:31.822
cmrwv9bru00013ob4rppcmovm	cmr5fjihw000vqs55y8i87kv5	\N	/api/external/getUserID	{"token": "7852bae77b9d942dcd3ea7d3fa36abfb", "agent_id": "37220", "timestamp": "1784772153760", "account_name": "MzJaDpxUHpBOEbWGYkbi"}	{"msg": "Token expired", "code": 4, "data": [], "count": 0}	4	Token Expired	\N	2026-07-23 02:02:34.074
cmrwv9c2j00033ob4dkxyrunc	cmr5fjihw000vqs55y8i87kv5	\N	/api/external/getUserID	{"token": "69e1c6cb2103656419f2ed6a8d43235f", "agent_id": "37220", "timestamp": "1784772154", "account_name": "MzJaDpxUHpBOEbWGYkbi"}	{"msg": "Invalid user ID", "code": 8, "data": [], "count": 0}	8	Invalid User ID	\N	2026-07-23 02:02:34.46
cmrwv9e7r00083ob46f0voapw	cmr5fjihw000vqs55y8i87kv5	\N	/api/external/addUser	{"token": "473d15e85840165456a37bc714d84bfe", "account": "MzJaDpxUHpBOEbWGYkbi", "agent_id": "37220", "login_pwd": "MoTpjszcYZW8zAa1!", "timestamp": "1784772157159"}	{"msg": "Token expired", "code": 4, "data": [], "count": 0}	4	Token Expired	\N	2026-07-23 02:02:37.239
cmrwv9eiy000a3ob49vmdmdt5	cmr5fjihw000vqs55y8i87kv5	\N	/api/external/addUser	{"token": "81b8cec34b566e590c91f52045a5cf5b", "account": "MzJaDpxUHpBOEbWGYkbi", "agent_id": "37220", "login_pwd": "MoTpjszcYZW8zAa1!", "timestamp": "1784772157"}	{"msg": "Success", "code": 0, "data": {"user_id": "15477214", "account_name": "mzjadpxuhpboebwgykbi"}, "count": 0}	200	\N	\N	2026-07-23 02:02:37.642
cmrybmjnq000e3ob46cu2v6k5	cmr5fjihw000vqs55y8i87kv5	\N	/api/external/getUserID	{"token": "6dc728e7c8eb9372798108f4557d787f", "agent_id": "37220", "timestamp": "1784860110", "account_name": "UAxPHSDHMyFmNiBpawJ"}	{"msg": "Invalid user ID", "code": 8, "data": [], "count": 0}	8	Invalid User ID	\N	2026-07-24 02:28:30.798
cmrybmmwy000j3ob4celo6z3i	cmr5fjihw000vqs55y8i87kv5	\N	/api/external/addUser	{"token": "a5f63aecc7b260eac92194bdd8dd9a06", "account": "UAxPHSDHMyFmNiBpawJ", "agent_id": "37220", "login_pwd": "Q97MBo41TvapLAa1!", "timestamp": "1784860114"}	{"msg": "Success", "code": 0, "data": {"user_id": "15484152", "account_name": "uaxphsdhmyfmnibpawj"}, "count": 0}	200	\N	\N	2026-07-24 02:28:35.074
cmrzbgtr40007jaf750ux72h7	cmr69xaxy0000yfqf0lk4ujmo	15279483	/api/external/userBalance	{"token": "bf7aca2b0acb7f3895360649b82f999b", "user_id": "15279483", "agent_id": "178114", "timestamp": "1784920309822"}	{"msg": "Token expired", "code": 4, "data": [], "count": 0}	4	Token Expired	\N	2026-07-24 19:11:50.176
cmrzbgu290009jaf7rcs5p29z	cmr69xaxy0000yfqf0lk4ujmo	15279483	/api/external/userBalance	{"token": "ff1d5f4a393d7999dd00dee0602ad41d", "user_id": "15279483", "agent_id": "178114", "timestamp": "1784920310"}	{"msg": "Success", "code": 0, "data": {"user_balance": "5"}, "count": 0}	200	\N	\N	2026-07-24 19:11:50.577
cmrzbh1dg000bjaf72pcim5sw	cmr69xaxy0000yfqf0lk4ujmo	15279483	/api/external/userBalance	{"token": "448c0f74f96098cdc7cb99733fb4ded1", "user_id": "15279483", "agent_id": "178114", "timestamp": "1784920319"}	{"msg": "Success", "code": 0, "data": {"user_balance": "5"}, "count": 0}	200	\N	\N	2026-07-24 19:11:59.799
cmrzuwwk0000djaf7j9rr865h	cmr5fjihw000vqs55y8i87kv5	\N	/api/external/getUserID	{"token": "a4939dfa7c89797f4fb18cdcb37c13bf", "agent_id": "37220", "timestamp": "1784952972678", "account_name": "PVlpmURjENfIANlQFvZS"}	{"msg": "Token expired", "code": 4, "data": [], "count": 0}	4	Token Expired	\N	2026-07-25 04:16:13.008
cmrzuwx64000fjaf79zc5xlah	cmr5fjihw000vqs55y8i87kv5	\N	/api/external/getUserID	{"token": "6b9dbe53297032aec20032bf72ec3575", "agent_id": "37220", "timestamp": "1784952973", "account_name": "PVlpmURjENfIANlQFvZS"}	{"msg": "Invalid user ID", "code": 8, "data": [], "count": 0}	8	Invalid User ID	\N	2026-07-25 04:16:13.804
cmrzux3qd000kjaf7gfz3h4g8	cmr5fjihw000vqs55y8i87kv5	\N	/api/external/addUser	{"token": "5506047e064b626fbead66339e17f864", "account": "PVlpmURjENfIANlQFvZS", "agent_id": "37220", "login_pwd": "aFqepi0QO37y8Aa1!", "timestamp": "1784952982176"}	{"msg": "Token expired", "code": 4, "data": [], "count": 0}	4	Token Expired	\N	2026-07-25 04:16:22.309
cmrzux4bl000mjaf7asekfgdf	cmr5fjihw000vqs55y8i87kv5	\N	/api/external/addUser	{"token": "c8efc2ef98584abbb17f53859376e8b7", "account": "PVlpmURjENfIANlQFvZS", "agent_id": "37220", "login_pwd": "aFqepi0QO37y8Aa1!", "timestamp": "1784952982"}	{"msg": "Success", "code": 0, "data": {"user_id": "15491115", "account_name": "pvlpmurjenfianlqfvzs"}, "count": 0}	200	\N	\N	2026-07-25 04:16:23.074
cmrdm63u80005fotg72poq463	\N	\N	/api/external/agentBalance	{}	"<!DOCTYPE html>\\n<!--[if lt IE 7]> <html class=\\"no-js ie6 oldie\\" lang=\\"en-US\\"> <![endif]-->\\n<!--[if IE 7]>    <html class=\\"no-js ie7 oldie\\" lang=\\"en-US\\"> <![endif]-->\\n<!--[if IE 8]>    <html class=\\"no-js ie8 oldie\\" lang=\\"en-US\\"> <![endif]-->\\n<!--[if gt IE 8]><!--> <html class=\\"no-js\\" lang=\\"en-US\\"> <!--<![endif]-->\\n<head>\\n<title>Attention Required! | Cloudflare</title>\\n<meta charset=\\"UTF-8\\" />\\n<meta http-equiv=\\"Content-Type\\" content=\\"text/html; charset=UTF-8\\" />\\n<meta http-equiv=\\"X-UA-Compatible\\" content=\\"IE=Edge\\" />\\n<meta name=\\"robots\\" content=\\"noindex, nofollow\\" />\\n<meta name=\\"viewport\\" content=\\"width=device-width,initial-scale=1\\" />\\n<link rel=\\"stylesheet\\" id=\\"cf_styles-css\\" href=\\"/cdn-cgi/styles/cf.errors.css\\" />\\n<!--[if lt IE 9]><link rel=\\"stylesheet\\" id='cf_styles-ie-css' href=\\"/cdn-cgi/styles/cf.errors.ie.css\\" /><![endif]-->\\n<style>body{margin:0;padding:0}</style>\\n\\n\\n<!--[if gte IE 10]><!-->\\n<script type=\\"4392819343d9b7bd0ff3bf70-text/javascript\\">\\n  if (!navigator.cookieEnabled) {\\n    window.addEventListener('DOMContentLoaded', function () {\\n      var cookieEl = document.getElementById('cookie-alert');\\n      cookieEl.style.display = 'block';\\n    })\\n  }\\n</script>\\n<!--<![endif]-->\\n\\n</head>\\n<body>\\n  <div id=\\"cf-wrapper\\">\\n    <div class=\\"cf-alert cf-alert-error cf-cookie-error\\" id=\\"cookie-alert\\" data-translate=\\"enable_cookies\\">Please enable cookies.</div>\\n    <div id=\\"cf-error-details\\" class=\\"cf-error-details-wrapper\\">\\n      <div class=\\"cf-wrapper cf-header cf-error-overview\\">\\n        <h1 data-translate=\\"block_headline\\">Sorry, you have been blocked</h1>\\n        <h2 class=\\"cf-subheadline\\"><span data-translate=\\"unable_to_access\\">You are unable to access</span> vblink777.club</h2>\\n      </div><!-- /.header -->\\n\\n      <div class=\\"cf-section cf-highlight\\">\\n        <div class=\\"cf-wrapper\\">\\n          <div class=\\"cf-screenshot-container cf-screenshot-full\\">\\n            \\n              <span class=\\"cf-no-screenshot error\\"></span>\\n            \\n          </div>\\n        </div>\\n      </div><!-- /.captcha-container -->\\n\\n      <div class=\\"cf-section cf-wrapper\\">\\n        <div class=\\"cf-columns two\\">\\n          <div class=\\"cf-column\\">\\n            <h2 data-translate=\\"blocked_why_headline\\">Why have I been blocked?</h2>\\n\\n            <p data-translate=\\"blocked_why_detail\\">This website is using a security service to protect itself from online attacks. The action you just performed triggered the security solution. There are several actions that could trigger this block including submitting a certain word or phrase, a SQL command or malformed data.</p>\\n          </div>\\n\\n          <div class=\\"cf-column\\">\\n            <h2 data-translate=\\"blocked_resolve_headline\\">What can I do to resolve this?</h2>\\n\\n            <p data-translate=\\"blocked_resolve_detail\\">You can email the site owner to let them know you were blocked. Please include what you were doing when this page came up and the Cloudflare Ray ID found at the bottom of this page.</p>\\n          </div>\\n        </div>\\n      </div><!-- /.section -->\\n\\n      <div class=\\"cf-error-footer cf-wrapper w-240 lg:w-full py-10 sm:py-4 sm:px-8 mx-auto text-center sm:text-left border-solid border-0 border-t border-gray-300\\">\\n    <p class=\\"text-13\\">\\n      <span class=\\"cf-footer-item sm:block sm:mb-1\\">Cloudflare Ray ID: <strong class=\\"font-semibold\\">a188158798f34464</strong></span>\\n      <span class=\\"cf-footer-separator sm:hidden\\">&bull;</span>\\n      <span id=\\"cf-footer-item-ip\\" class=\\"cf-footer-item hidden sm:block sm:mb-1\\">\\n        Your IP:\\n        <button type=\\"button\\" id=\\"cf-footer-ip-reveal\\" class=\\"cf-footer-ip-reveal-btn\\">Click to reveal</button>\\n        <span class=\\"hidden\\" id=\\"cf-footer-ip\\">169.150.218.58</span>\\n        <span class=\\"cf-footer-separator sm:hidden\\">&bull;</span>\\n      </span>\\n      <span class=\\"cf-footer-item sm:block sm:mb-1\\"><span>Performance &amp; security by</span> <a rel=\\"noopener noreferrer\\" href=\\"https://www.cloudflare.com/5xx-error-landing\\" id=\\"brand_link\\" target=\\"_blank\\">Cloudflare</a></span>\\n      \\n    </p>\\n    <script type=\\"4392819343d9b7bd0ff3bf70-text/javascript\\">(function(){function d(){var b=a.getElementById(\\"cf-footer-item-ip\\"),c=a.getElementById(\\"cf-footer-ip-reveal\\");b&&\\"classList\\"in b&&(b.classList.remove(\\"hidden\\"),c.addEventListener(\\"click\\",function(){c.classList.add(\\"hidden\\");a.getElementById(\\"cf-footer-ip\\").classList.remove(\\"hidden\\")}))}var a=document;document.addEventListener&&a.addEventListener(\\"DOMContentLoaded\\",d)})();</script>\\n  </div><!-- /.error-footer -->\\n\\n    </div><!-- /#cf-error-details -->\\n  </div><!-- /#cf-wrapper -->\\n\\n  <script type=\\"4392819343d9b7bd0ff3bf70-text/javascript\\">\\n    window._cf_translation = {};\\n    \\n    \\n  </script>\\n<script src=\\"/cdn-cgi/scripts/7d0fa10a/cloudflare-static/rocket-loader.min.js\\" data-cf-settings=\\"4392819343d9b7bd0ff3bf70-|49\\" defer></script></body>\\n</html>"	403	Request failed with status code 403	\N	2026-07-09 09:10:29.936
cmrdm6c9p0007fotgxbqiycln	\N	\N	/api/external/agentBalance	{}	"<!DOCTYPE html>\\n<!--[if lt IE 7]> <html class=\\"no-js ie6 oldie\\" lang=\\"en-US\\"> <![endif]-->\\n<!--[if IE 7]>    <html class=\\"no-js ie7 oldie\\" lang=\\"en-US\\"> <![endif]-->\\n<!--[if IE 8]>    <html class=\\"no-js ie8 oldie\\" lang=\\"en-US\\"> <![endif]-->\\n<!--[if gt IE 8]><!--> <html class=\\"no-js\\" lang=\\"en-US\\"> <!--<![endif]-->\\n<head>\\n<title>Attention Required! | Cloudflare</title>\\n<meta charset=\\"UTF-8\\" />\\n<meta http-equiv=\\"Content-Type\\" content=\\"text/html; charset=UTF-8\\" />\\n<meta http-equiv=\\"X-UA-Compatible\\" content=\\"IE=Edge\\" />\\n<meta name=\\"robots\\" content=\\"noindex, nofollow\\" />\\n<meta name=\\"viewport\\" content=\\"width=device-width,initial-scale=1\\" />\\n<link rel=\\"stylesheet\\" id=\\"cf_styles-css\\" href=\\"/cdn-cgi/styles/cf.errors.css\\" />\\n<!--[if lt IE 9]><link rel=\\"stylesheet\\" id='cf_styles-ie-css' href=\\"/cdn-cgi/styles/cf.errors.ie.css\\" /><![endif]-->\\n<style>body{margin:0;padding:0}</style>\\n\\n\\n<!--[if gte IE 10]><!-->\\n<script type=\\"fc01217d35026fb6108ef29e-text/javascript\\">\\n  if (!navigator.cookieEnabled) {\\n    window.addEventListener('DOMContentLoaded', function () {\\n      var cookieEl = document.getElementById('cookie-alert');\\n      cookieEl.style.display = 'block';\\n    })\\n  }\\n</script>\\n<!--<![endif]-->\\n\\n</head>\\n<body>\\n  <div id=\\"cf-wrapper\\">\\n    <div class=\\"cf-alert cf-alert-error cf-cookie-error\\" id=\\"cookie-alert\\" data-translate=\\"enable_cookies\\">Please enable cookies.</div>\\n    <div id=\\"cf-error-details\\" class=\\"cf-error-details-wrapper\\">\\n      <div class=\\"cf-wrapper cf-header cf-error-overview\\">\\n        <h1 data-translate=\\"block_headline\\">Sorry, you have been blocked</h1>\\n        <h2 class=\\"cf-subheadline\\"><span data-translate=\\"unable_to_access\\">You are unable to access</span> vblink777.club</h2>\\n      </div><!-- /.header -->\\n\\n      <div class=\\"cf-section cf-highlight\\">\\n        <div class=\\"cf-wrapper\\">\\n          <div class=\\"cf-screenshot-container cf-screenshot-full\\">\\n            \\n              <span class=\\"cf-no-screenshot error\\"></span>\\n            \\n          </div>\\n        </div>\\n      </div><!-- /.captcha-container -->\\n\\n      <div class=\\"cf-section cf-wrapper\\">\\n        <div class=\\"cf-columns two\\">\\n          <div class=\\"cf-column\\">\\n            <h2 data-translate=\\"blocked_why_headline\\">Why have I been blocked?</h2>\\n\\n            <p data-translate=\\"blocked_why_detail\\">This website is using a security service to protect itself from online attacks. The action you just performed triggered the security solution. There are several actions that could trigger this block including submitting a certain word or phrase, a SQL command or malformed data.</p>\\n          </div>\\n\\n          <div class=\\"cf-column\\">\\n            <h2 data-translate=\\"blocked_resolve_headline\\">What can I do to resolve this?</h2>\\n\\n            <p data-translate=\\"blocked_resolve_detail\\">You can email the site owner to let them know you were blocked. Please include what you were doing when this page came up and the Cloudflare Ray ID found at the bottom of this page.</p>\\n          </div>\\n        </div>\\n      </div><!-- /.section -->\\n\\n      <div class=\\"cf-error-footer cf-wrapper w-240 lg:w-full py-10 sm:py-4 sm:px-8 mx-auto text-center sm:text-left border-solid border-0 border-t border-gray-300\\">\\n    <p class=\\"text-13\\">\\n      <span class=\\"cf-footer-item sm:block sm:mb-1\\">Cloudflare Ray ID: <strong class=\\"font-semibold\\">a18815cd0a63e5e0</strong></span>\\n      <span class=\\"cf-footer-separator sm:hidden\\">&bull;</span>\\n      <span id=\\"cf-footer-item-ip\\" class=\\"cf-footer-item hidden sm:block sm:mb-1\\">\\n        Your IP:\\n        <button type=\\"button\\" id=\\"cf-footer-ip-reveal\\" class=\\"cf-footer-ip-reveal-btn\\">Click to reveal</button>\\n        <span class=\\"hidden\\" id=\\"cf-footer-ip\\">169.150.218.58</span>\\n        <span class=\\"cf-footer-separator sm:hidden\\">&bull;</span>\\n      </span>\\n      <span class=\\"cf-footer-item sm:block sm:mb-1\\"><span>Performance &amp; security by</span> <a rel=\\"noopener noreferrer\\" href=\\"https://www.cloudflare.com/5xx-error-landing\\" id=\\"brand_link\\" target=\\"_blank\\">Cloudflare</a></span>\\n      \\n    </p>\\n    <script type=\\"fc01217d35026fb6108ef29e-text/javascript\\">(function(){function d(){var b=a.getElementById(\\"cf-footer-item-ip\\"),c=a.getElementById(\\"cf-footer-ip-reveal\\");b&&\\"classList\\"in b&&(b.classList.remove(\\"hidden\\"),c.addEventListener(\\"click\\",function(){c.classList.add(\\"hidden\\");a.getElementById(\\"cf-footer-ip\\").classList.remove(\\"hidden\\")}))}var a=document;document.addEventListener&&a.addEventListener(\\"DOMContentLoaded\\",d)})();</script>\\n  </div><!-- /.error-footer -->\\n\\n    </div><!-- /#cf-error-details -->\\n  </div><!-- /#cf-wrapper -->\\n\\n  <script type=\\"fc01217d35026fb6108ef29e-text/javascript\\">\\n    window._cf_translation = {};\\n    \\n    \\n  </script>\\n<script src=\\"/cdn-cgi/scripts/7d0fa10a/cloudflare-static/rocket-loader.min.js\\" data-cf-settings=\\"fc01217d35026fb6108ef29e-|49\\" defer></script></body>\\n</html>"	403	Request failed with status code 403	\N	2026-07-09 09:10:40.861
cms2vw0cb000ujaf76t41rdsq	cmr69xaxy0000yfqf0lk4ujmo	15279483	/api/external/userBalance	{"token": "72cbb4d77ac153764ceabb9531a07851", "user_id": "15279483", "agent_id": "178114", "timestamp": "1785136009"}	{"msg": "Success", "code": 0, "data": {"user_balance": "5"}, "count": 0}	200	\N	\N	2026-07-27 07:06:49.404
cms2vwkmb000wjaf712wjf9bh	cmr5fjihw000vqs55y8i87kv5	\N	/api/external/addUser	{"token": "e42fadd4a32fbf2110686458ed8033aa", "account": "annalaurel_pl12", "agent_id": "37220", "login_pwd": "Default123!", "timestamp": "1785136035"}	{"msg": "Account name already exists", "code": 20, "data": [], "count": 0}	20	Username Already Exists	\N	2026-07-27 07:07:15.683
cms2vwkwg000yjaf751nrd4f0	cmr5fjihw000vqs55y8i87kv5	\N	/api/external/addUser	{"token": "e42fadd4a32fbf2110686458ed8033aa", "account": "annalaurel_6192", "agent_id": "37220", "login_pwd": "Default123!", "timestamp": "1785136035"}	{"msg": "Success", "code": 0, "data": {"user_id": "15509387", "account_name": "annalaurel_6192"}, "count": 0}	200	\N	\N	2026-07-27 07:07:16.048
cms2vwstp0012jaf7s8ff5v38	cmr69xaxy0000yfqf0lk4ujmo	15279483	/api/external/userBalance	{"token": "42f3e2fccba4091d3dfabdaec5d552a1", "user_id": "15279483", "agent_id": "178114", "timestamp": "1785136046"}	{"msg": "Success", "code": 0, "data": {"user_balance": "5"}, "count": 0}	200	\N	\N	2026-07-27 07:07:26.318
cms2vwsv90014jaf79eygv1lv	cmr5fjihw000vqs55y8i87kv5	15509387	/api/external/userBalance	{"token": "f627766a23721ffc3846f5d1c5924ec3", "user_id": "15509387", "agent_id": "37220", "timestamp": "1785136046"}	{"msg": "Success", "code": 0, "data": {"user_balance": "0"}, "count": 0}	200	\N	\N	2026-07-27 07:07:26.32
cms2vwt6w0016jaf7xjfsiu4e	cmr5ffgpe000mqs55ym8xwjyg	1485006	/api/external/userBalance	{"token": "1f57f842a904b0e1d39468a95046e2b7", "user_id": "1485006", "agent_id": "944", "timestamp": "1785136046470"}	{"msg": "unKnownErrorCode", "code": 4, "data": [], "count": 0}	4	Token Expired	\N	2026-07-27 07:07:26.792
cms2vwtfn0018jaf7fs1f7hon	cmr5ffgpe000mqs55ym8xwjyg	1485006	/api/external/userBalance	{"token": "8f59fe75bb18b77b7ce078f0655b0cd7", "user_id": "1485006", "agent_id": "944", "timestamp": "1785136047"}	{"msg": "unKnownErrorCode", "code": 0, "data": {"user_balance": "0"}, "count": 0}	200	\N	\N	2026-07-27 07:07:27.107
cms2vx2va001ajaf7aufnqv5i	cmr5ffgpe000mqs55ym8xwjyg	1485006	/api/external/userBalance	{"token": "7bc1645474315de2f1b19a62c5211e80", "user_id": "1485006", "agent_id": "944", "timestamp": "1785136059"}	{"msg": "unKnownErrorCode", "code": 0, "data": {"user_balance": "0"}, "count": 0}	200	\N	\N	2026-07-27 07:07:39.334
cms2wiu1z00146wjsrn2gr5nb	cmr69xaxy0000yfqf0lk4ujmo	15290343	/api/external/userBalance	{"user_id": "15290343"}	"read ECONNRESET"	500	read ECONNRESET	\N	2026-07-27 07:24:34.343
cms3gn7th000130c0f5uc2i2p	cmr5fjihw000vqs55y8i87kv5	\N	/api/external/getUserID	{"token": "021d0edc5afb07ae1f9021d4d98f37ee", "agent_id": "37220", "timestamp": "1785170870761", "account_name": "Aaa"}	{"msg": "Token expired", "code": 4, "data": [], "count": 0}	4	Token Expired	\N	2026-07-27 16:47:51.124
cms3gn83s000330c06xmmu0lo	cmr5fjihw000vqs55y8i87kv5	\N	/api/external/getUserID	{"token": "e041a40fd481a18ce386b07764c191a7", "agent_id": "37220", "timestamp": "1785170871", "account_name": "Aaa"}	{"msg": "Invalid user ID", "code": 8, "data": [], "count": 0}	8	Invalid User ID	\N	2026-07-27 16:47:51.496
cms3gnsns000830c036zq2ptf	cmr5fjihw000vqs55y8i87kv5	\N	/api/external/addUser	{"token": "cb77b3b0edadb5f9d9dfd0a620a34a94", "account": "Aaa", "agent_id": "37220", "login_pwd": "Jammy@321", "timestamp": "1785170898008"}	{"msg": "Token expired", "code": 4, "data": [], "count": 0}	4	Token Expired	\N	2026-07-27 16:48:18.136
cms3gnsxj000a30c0dggqkww1	cmr5fjihw000vqs55y8i87kv5	\N	/api/external/addUser	{"token": "bb8f84a2c24ad328f8cdd1208b41c58e", "account": "Aaa", "agent_id": "37220", "login_pwd": "Jammy@321", "timestamp": "1785170898"}	{"msg": "Account name already exists", "code": 20, "data": [], "count": 0}	20	Username Already Exists	\N	2026-07-27 16:48:18.487
cms3gnt7i000c30c0itvnt24t	cmr5fjihw000vqs55y8i87kv5	\N	/api/external/addUser	{"token": "892753577b2b30cc68bf7baadbaf593f", "account": "Aaa_4672", "agent_id": "37220", "login_pwd": "Jammy@321", "timestamp": "1785170898760"}	{"msg": "Token expired", "code": 4, "data": [], "count": 0}	4	Token Expired	\N	2026-07-27 16:48:18.846
cms3gnthb000e30c04gcaq9el	cmr5fjihw000vqs55y8i87kv5	\N	/api/external/addUser	{"token": "cee1c9637491d09cba15b67411072328", "account": "Aaa_4672", "agent_id": "37220", "login_pwd": "Jammy@321", "timestamp": "1785170899"}	{"msg": "Success", "code": 0, "data": {"user_id": "15512848", "account_name": "aaa_4672"}, "count": 0}	200	\N	\N	2026-07-27 16:48:19.2
cms3h1h2l000r30c0uqk3tbwk	cmr69xaxy0000yfqf0lk4ujmo	\N	/api/external/addUser	{"token": "fce261d297fba1e084fe138e8597c631", "account": "Aaa", "agent_id": "178114", "login_pwd": "Default123!", "timestamp": "1785171535981"}	{"msg": "Token expired", "code": 4, "data": [], "count": 0}	4	Token Expired	\N	2026-07-27 16:58:56.301
cmshd1zfz0001yfiydz2pgxi1	cmr7lwt20002rnggfbn8d7kil	\N	/api/external/agentBalance	{"token": "744ebb2ccd19ef78e3b30509d3a2d06c", "agent_id": "122030", "timestamp": "1786011366649"}	{"msg": "Token expired", "code": 4, "data": [], "count": 0}	4	Token Expired	\N	2026-08-06 10:16:08.112
cms3h1hca000t30c04lynu5za	cmr69xaxy0000yfqf0lk4ujmo	\N	/api/external/addUser	{"token": "0c6ce2edb60a0b5cfd43771dc02b6ba9", "account": "Aaa", "agent_id": "178114", "login_pwd": "Default123!", "timestamp": "1785171536"}	{"msg": "Account name already exists", "code": 20, "data": [], "count": 0}	20	Username Already Exists	\N	2026-07-27 16:58:56.65
cms3h1hlv000v30c0ep83vwdx	cmr69xaxy0000yfqf0lk4ujmo	\N	/api/external/addUser	{"token": "9c86c5d308baf634f89e31f5690d54e4", "account": "Aaa_5356", "agent_id": "178114", "login_pwd": "Default123!", "timestamp": "1785171536922"}	{"msg": "Token expired", "code": 4, "data": [], "count": 0}	4	Token Expired	\N	2026-07-27 16:58:56.995
cms3h1hwk000x30c04l1yntos	cmr69xaxy0000yfqf0lk4ujmo	\N	/api/external/addUser	{"token": "1f4a19f4b3d5c0d8423ed7fcf0c2a563", "account": "Aaa_5356", "agent_id": "178114", "login_pwd": "Default123!", "timestamp": "1785171537"}	{"msg": "Success", "code": 0, "data": {"user_id": "15512904", "account_name": "aaa_5356"}, "count": 0}	200	\N	\N	2026-07-27 16:58:57.38
cms3h3egd001130c0n1aekzfu	cmr69xaxy0000yfqf0lk4ujmo	15512904	/api/external/userBalance	{"token": "9374ad43341b0f7a3f431f563ad2ff10", "user_id": "15512904", "agent_id": "178114", "timestamp": "1785171625"}	{"msg": "Success", "code": 0, "data": {"user_balance": "0"}, "count": 0}	200	\N	\N	2026-07-27 17:00:26.081
cms3kg9bu000a4zzfd4ktxcyv	cmr7lwt20002rnggfbn8d7kil	16820358	/api/external/userBalance	{"token": "3983deca87d6b9d2ef19793eaa0f018a", "user_id": "16820358", "agent_id": "122030", "timestamp": "1785177264805"}	{"msg": "Token expired", "code": 4, "data": [], "count": 0}	4	Token Expired	\N	2026-07-27 18:34:24.954
cms3kg9kq000c4zzfagvneivi	cmr7lwt20002rnggfbn8d7kil	16820358	/api/external/userBalance	{"token": "55d7127d5f72db27cbd97af9c7b5a6c4", "user_id": "16820358", "agent_id": "122030", "timestamp": "1785177265"}	{"msg": "Success", "code": 0, "data": {"user_balance": "0"}, "count": 0}	200	\N	\N	2026-07-27 18:34:25.274
cms53balz000k4zzffzwh9zxh	cmr69xaxy0000yfqf0lk4ujmo	15277896	/api/external/userBalance	{"token": "5f8a693b39964bf3718b5fc04f1c4afb", "user_id": "15277896", "agent_id": "178114", "timestamp": "1785269412010"}	{"msg": "Token expired", "code": 4, "data": [], "count": 0}	4	Token Expired	\N	2026-07-28 20:10:12.214
cms53bawj000m4zzf9o4wa17p	cmr69xaxy0000yfqf0lk4ujmo	15277896	/api/external/userBalance	{"token": "faf108b31db66a466c9d8dd6d84b9748", "user_id": "15277896", "agent_id": "178114", "timestamp": "1785269412"}	{"msg": "Success", "code": 0, "data": {"user_balance": "0"}, "count": 0}	200	\N	\N	2026-07-28 20:10:12.595
cms53bgue000o4zzfor8va4zi	cmr69xaxy0000yfqf0lk4ujmo	15277896	/api/external/resetPassword	{"token": "0ab5ca1cd56b14cfad9103b037c01eab", "user_id": "15277896", "agent_id": "178114", "login_pwd": "NxS_8fe17945", "timestamp": "1785269420"}	{"msg": "Success", "code": 0, "data": null, "count": 0}	200	\N	\N	2026-07-28 20:10:20.294
cms53bnr2000q4zzf2oyo2qs5	cmr69xaxy0000yfqf0lk4ujmo	15277896	/api/external/playerOffline	{"token": "258d06517c59dc50dd1507c215a5fbde", "user_id": "15277896", "agent_id": "178114", "timestamp": "1785269429"}	{"msg": "Success", "code": 0, "data": null, "count": 0}	200	\N	\N	2026-07-28 20:10:29.246
cms53bopm000u4zzf4kmq6rew	cmr69xaxy0000yfqf0lk4ujmo	15277896	/api/external/recharge	{"token": "28acbd805dbff87f601fcd06bd423deb", "amount": "6.5", "user_id": "15277896", "agent_id": "178114", "order_id": "TX_1785269429513_afhql", "timestamp": "1785269430"}	{"msg": "Success", "code": 0, "data": {"amount": "6.5", "pay_order_id": "TX_1785269429513_afhql", "user_balance": "6.5", "agent_balance": "982.05", "transaction_id": "17852694301135489", "transaction_time": "1785269430"}, "count": 0}	200	\N	\N	2026-07-28 20:10:30.49
cms53bq0x000y4zzfkfnl3tjb	cmr69xaxy0000yfqf0lk4ujmo	15277896	/api/external/userBalance	{"token": "38a5ff4d0cbad58ea6ede631f2a1c3cb", "user_id": "15277896", "agent_id": "178114", "timestamp": "1785269432"}	{"msg": "Success", "code": 0, "data": {"user_balance": "6.5"}, "count": 0}	200	\N	\N	2026-07-28 20:10:32.193
cms53bse600104zzf8e9no5od	cmr69xaxy0000yfqf0lk4ujmo	15277896	/api/external/userBalance	{"token": "2c3d44a01ae73ea19ee3323e97b9be1b", "user_id": "15277896", "agent_id": "178114", "timestamp": "1785269435"}	{"msg": "Success", "code": 0, "data": {"user_balance": "6.5"}, "count": 0}	200	\N	\N	2026-07-28 20:10:35.263
cms7jk2pi00011354a5fbrfom	cmr5fjihw000vqs55y8i87kv5	\N	/api/external/getUserID	{"token": "bb3884acf8d9b133352e89dd31337b15", "agent_id": "37220", "timestamp": "1785417627703", "account_name": "ceseds"}	{"msg": "Token expired", "code": 4, "data": [], "count": 0}	4	Token Expired	\N	2026-07-30 13:20:28.086
cms7jk30a00031354gxyb8wht	cmr5fjihw000vqs55y8i87kv5	\N	/api/external/getUserID	{"token": "490576dfe21ea4b0e6d26a6567c813f4", "agent_id": "37220", "timestamp": "1785417628", "account_name": "ceseds"}	{"msg": "Invalid user ID", "code": 8, "data": [], "count": 0}	8	Invalid User ID	\N	2026-07-30 13:20:28.474
cms7jkc1k00081354pl2tcm2y	cmr5fjihw000vqs55y8i87kv5	\N	/api/external/addUser	{"token": "1f304b87e18d11637a155fd072179be1", "account": "ceseds", "agent_id": "37220", "login_pwd": "efdfrdrefdfrdr", "timestamp": "1785417640050"}	{"msg": "Token expired", "code": 4, "data": [], "count": 0}	4	Token Expired	\N	2026-07-30 13:20:40.184
cms7jkcbv000a1354cq3fpqfd	cmr5fjihw000vqs55y8i87kv5	\N	/api/external/addUser	{"token": "b09ffd7ac666d42d783bb887a6fe879e", "account": "ceseds", "agent_id": "37220", "login_pwd": "efdfrdrefdfrdr", "timestamp": "1785417640"}	{"msg": "Success", "code": 0, "data": {"user_id": "15534552", "account_name": "ceseds"}, "count": 0}	200	\N	\N	2026-07-30 13:20:40.555
cms7jnerq000k1354bqb57lab	cmr69xaxy0000yfqf0lk4ujmo	15512904	/api/external/userBalance	{"token": "44bcb557b0efe769583110534b180408", "user_id": "15512904", "agent_id": "178114", "timestamp": "1785417783139"}	{"msg": "Token expired", "code": 4, "data": [], "count": 0}	4	Token Expired	\N	2026-07-30 13:23:03.541
cms7jnf1g000m1354eda0wt10	cmr69xaxy0000yfqf0lk4ujmo	15512904	/api/external/userBalance	{"token": "b24e852aa28a9a6667468b4e39ea45c4", "user_id": "15512904", "agent_id": "178114", "timestamp": "1785417783"}	{"msg": "Success", "code": 0, "data": {"user_balance": "0"}, "count": 0}	200	\N	\N	2026-07-30 13:23:04.037
cmsdo73vl000akutgdz068s1j	cmr69xaxy0000yfqf0lk4ujmo	15290343	/api/external/userBalance	{"token": "520ee3815e6a453aec2d897c75bf3f02", "user_id": "15290343", "agent_id": "178114", "timestamp": "1785788217795"}	{"msg": "Token expired", "code": 4, "data": [], "count": 0}	4	Token Expired	\N	2026-08-03 20:16:58.21
cmsdo7466000ckutgoqzq4gtn	cmr69xaxy0000yfqf0lk4ujmo	15290343	/api/external/userBalance	{"token": "1a08b2855a967b4245aab0e9563f9cb7", "user_id": "15290343", "agent_id": "178114", "timestamp": "1785788218"}	{"msg": "Success", "code": 0, "data": {"user_balance": "0"}, "count": 0}	200	\N	\N	2026-08-03 20:16:58.59
cmsdo799f000ekutgzpxlphya	cmr69xaxy0000yfqf0lk4ujmo	15290343	/api/external/resetPassword	{"token": "a8badc357b6226bc4b77e19436823bee", "user_id": "15290343", "agent_id": "178114", "login_pwd": "NxS_a8e20ab4", "timestamp": "1785788225"}	{"msg": "Success", "code": 0, "data": null, "count": 0}	200	\N	\N	2026-08-03 20:17:05.187
cmsdo7j3y000gkutgfztmp9sf	cmr69xaxy0000yfqf0lk4ujmo	15290343	/api/external/userBalance	{"token": "ca06688738b5713458a18aeaa2970092", "user_id": "15290343", "agent_id": "178114", "timestamp": "1785788237"}	{"msg": "Success", "code": 0, "data": {"user_balance": "0"}, "count": 0}	200	\N	\N	2026-08-03 20:17:17.95
cmsdo7mhn000ikutghsife7u2	cmr69xaxy0000yfqf0lk4ujmo	15290343	/api/external/userBalance	{"token": "6233a132670adc4431a8354bbe72c8cc", "user_id": "15290343", "agent_id": "178114", "timestamp": "1785788242"}	{"msg": "Success", "code": 0, "data": {"user_balance": "0"}, "count": 0}	200	\N	\N	2026-08-03 20:17:22.275
cmsdp40nj0001cvkxksr4pzda	cmr5fjihw000vqs55y8i87kv5	ceseds	/api/external/userBalance	{"token": "2f1da3ca3beb510f2b087df39b7296f9", "user_id": "ceseds", "agent_id": "37220", "timestamp": "1785789753496"}	{"msg": "Token expired", "code": 4, "data": [], "count": 0}	4	Token Expired	\N	2026-08-03 20:42:33.678
cmsdp40xw0003cvkxpbyf2tgt	cmr5fjihw000vqs55y8i87kv5	ceseds	/api/external/userBalance	{"token": "662f4ae66f90bfd59fb5e9f98ac3f31c", "user_id": "ceseds", "agent_id": "37220", "timestamp": "1785789753"}	{"msg": "Invalid request parameters", "code": 2, "data": [], "count": 0}	2	Invalid Request Parameters	\N	2026-08-03 20:42:34.052
cmsdp4vkp0005cvkxirgzoxup	cmr69xaxy0000yfqf0lk4ujmo	15290343	/api/external/userBalance	{"token": "21be32b9533f9e7ce96815cf17ca8397", "user_id": "15290343", "agent_id": "178114", "timestamp": "1785789793414"}	{"msg": "Token expired", "code": 4, "data": [], "count": 0}	4	Token Expired	\N	2026-08-03 20:43:13.753
cmsdp4vv10007cvkxur0him0q	cmr69xaxy0000yfqf0lk4ujmo	15290343	/api/external/userBalance	{"token": "7d2d3e32de0d1d08c8e8da5e6b7ea7ad", "user_id": "15290343", "agent_id": "178114", "timestamp": "1785789794"}	{"msg": "Success", "code": 0, "data": {"user_balance": "0"}, "count": 0}	200	\N	\N	2026-08-03 20:43:14.125
cmsdp4z550009cvkxr9snlp8c	cmr69xaxy0000yfqf0lk4ujmo	15290343	/api/external/playerOffline	{"token": "a1efe5aabba4393e25dfb15b4a2eec65", "user_id": "15290343", "agent_id": "178114", "timestamp": "1785789798"}	{"msg": "Success", "code": 0, "data": null, "count": 0}	200	\N	\N	2026-08-03 20:43:18.378
cmsdp504m000dcvkxtday1oja	cmr69xaxy0000yfqf0lk4ujmo	15290343	/api/external/recharge	{"token": "06c942bfcca566a8ff6ab1ddf78792ed", "amount": "6.5", "user_id": "15290343", "agent_id": "178114", "order_id": "TX_1785789798652_1a2oo", "timestamp": "1785789799"}	{"msg": "Success", "code": 0, "data": {"amount": "6.5", "pay_order_id": "TX_1785789798652_1a2oo", "user_balance": "6.5", "agent_balance": "175.55", "transaction_id": "17857897991192963", "transaction_time": "1785789799"}, "count": 0}	200	\N	\N	2026-08-03 20:43:19.654
cmsdp51ju000hcvkx3xus2wh8	cmr69xaxy0000yfqf0lk4ujmo	15290343	/api/external/userBalance	{"token": "83be8be63ad872860176b48af811ef85", "user_id": "15290343", "agent_id": "178114", "timestamp": "1785789801"}	{"msg": "Success", "code": 0, "data": {"user_balance": "6.5"}, "count": 0}	200	\N	\N	2026-08-03 20:43:21.498
cmsfvh6d8000a7y6fhtmb7ci7	cmsfvgxvr00087y6fy1hmp5x7	\N	/api/external/agentBalance	{"token": "1e1534db4a28e0f430a18f890008f4a7", "agent_id": "Gamora123", "timestamp": "1785921377437"}	""	200	\N	\N	2026-08-05 09:16:17.66
cmsfvh9f8000c7y6fey1fzyku	cmsfvgxvr00087y6fy1hmp5x7	\N	/api/external/agentBalance	{"token": "c758426b53132ebb6c0fc356e59a8419", "agent_id": "Gamora123", "timestamp": "1785921381581"}	""	200	\N	\N	2026-08-05 09:16:21.62
cmsfvhl1u000e7y6fqs4h1ix5	cmsfvgxvr00087y6fy1hmp5x7	\N	/api/external/addUser	{"token": "5e9e7a3229baecd16597c3db3c8ac9a1", "account": "admin", "agent_id": "Gamora123", "login_pwd": "Default123!", "timestamp": "1785921396565"}	""	200	\N	\N	2026-08-05 09:16:36.69
cmsg81p7x0007at3a247l6dkh	cmsfvgxvr00087y6fy1hmp5x7	\N	/api/external/addUser	{"token": "9c7550e505d478841f15b11f1d469caf", "account": "rad", "agent_id": "Gamora123", "login_pwd": "Default123!", "timestamp": "1785942490309"}	""	200	\N	\N	2026-08-05 15:08:10.605
cmshbirwa000dat3azsz2exzd	cmsfvgxvr00087y6fy1hmp5x7	\N	/api/external/agentBalance	{"token": "ec256ceaf7fde7d0b0f496a3a27dfd2a", "agent_id": "Gamora123", "timestamp": "1786008791958"}	""	200	\N	\N	2026-08-06 09:33:12.25
cmshbishn000fat3awe5tmsit	cmsfvgxvr00087y6fy1hmp5x7	\N	/api/external/agentBalance	{"token": "4b4fbfae111b8c459f1ec8313f1381cb", "agent_id": "Gamora123", "timestamp": "1786008792977"}	""	200	\N	\N	2026-08-06 09:33:13.019
cmshbiurr000hat3awkfj2avi	cmsfvgxvr00087y6fy1hmp5x7	\N	/api/external/agentBalance	{"token": "f4079e8380f0aac0b1f697cf004571db", "agent_id": "Gamora123", "timestamp": "1786008795935"}	""	200	\N	\N	2026-08-06 09:33:15.975
cmshbj0n0000jat3aievgefuk	cmr7lwt20002rnggfbn8d7kil	\N	/api/external/agentBalance	{"token": "01f6c901bf66b8ffc8b94b879e23ded0", "agent_id": "122030", "timestamp": "1786008803253"}	{"msg": "Token expired", "code": 4, "data": [], "count": 0}	4	Token Expired	\N	2026-08-06 09:33:23.581
cmshbj0x1000lat3azp4dt15x	cmr7lwt20002rnggfbn8d7kil	\N	/api/external/agentBalance	{"token": "12056f7c520582633265e7164cbbfbab", "agent_id": "122030", "timestamp": "1786008803"}	{"msg": "Success", "code": 0, "data": {"agent_balance": "1000"}, "count": 0}	200	\N	\N	2026-08-06 09:33:23.941
cmshbj7sf000nat3avdwys77m	cmsfvgxvr00087y6fy1hmp5x7	\N	/api/external/agentBalance	{"token": "ed7e60b36a85323fabba53ab0b30c0c5", "agent_id": "Gamora123", "timestamp": "1786008812735"}	""	200	\N	\N	2026-08-06 09:33:32.847
cmshbkirf0010at3anzl8uf0o	cmsfvgxvr00087y6fy1hmp5x7	\N	/api/external/addUser	{"token": "4d737e390e4681dfe9182b553d68f97a", "account": "player001", "agent_id": "Gamora123", "login_pwd": "Default123!", "timestamp": "1786008873595"}	""	200	\N	\N	2026-08-06 09:34:33.724
cmshc61690003u5zn4k1rf5wu	cmsfvgxvr00087y6fy1hmp5x7	\N	/api/external/agentBalance	{"token": "f8c649f5184ecc309cf2f78150bd70f8", "agent_id": "Gamora123", "timestamp": "1786009877120"}	""	200	\N	\N	2026-08-06 09:51:17.361
cmshc64h80005u5znabrqavnu	cmsfvgxvr00087y6fy1hmp5x7	\N	/api/external/agentBalance	{"token": "10c89199487259706061414bf6cd27e8", "agent_id": "Gamora123", "timestamp": "1786009881601"}	""	200	\N	\N	2026-08-06 09:51:21.644
cmshct1v30001cfh1uzxrpl1w	cmsfvgxvr00087y6fy1hmp5x7	\N	/api/external/agentBalance	{}	"read ECONNRESET"	500	read ECONNRESET	\N	2026-08-06 10:09:11.342
cmshcy82r0003cfh1o9gwvokv	cmsfvgxvr00087y6fy1hmp5x7	\N	/api/external/agentBalance	{"token": "eb2df180073170497024867f3113dfa5", "agent_id": "Gamora123", "timestamp": "1786011190144"}	""	200	\N	\N	2026-08-06 10:13:12.676
cmshcyeap0005cfh1l7h17xt4	cmsfvgxvr00087y6fy1hmp5x7	\N	/api/external/agentBalance	{"token": "92a3c743875242c120754414644e8bec", "agent_id": "Gamora123", "timestamp": "1786011199764"}	""	200	\N	\N	2026-08-06 10:13:20.737
cmshd21c10005yfiygpolb1c0	cmr5fjihw000vqs55y8i87kv5	\N	/api/external/agentBalance	{"token": "4b78baa11a9fac9ac884ec28b78fbdaa", "agent_id": "37220", "timestamp": "1786011368881"}	{"msg": "Token expired", "code": 4, "data": [], "count": 0}	4	Token Expired	\N	2026-08-06 10:16:10.561
cmshd21a80003yfiynzcqywv9	cmr7lwt20002rnggfbn8d7kil	\N	/api/external/agentBalance	{"token": "389f1bdfdded0593b4dc9a4f683d03b5", "agent_id": "122030", "timestamp": "1786011370"}	{"msg": "Access ip is not white ip", "code": 5, "data": [], "count": 0}	5	Access IP Not Whitelisted	\N	2026-08-06 10:16:10.496
cmshd23ib0007yfiy1zvr9drh	cmr5fjihw000vqs55y8i87kv5	\N	/api/external/agentBalance	{"token": "4781f15636d818817b6c07c6b8df0722", "agent_id": "37220", "timestamp": "1786011372"}	{"msg": "Access ip is not white ip", "code": 5, "data": [], "count": 0}	5	Access IP Not Whitelisted	\N	2026-08-06 10:16:13.044
cmsi4doju000bu5znuymq41l7	cmr69xaxy0000yfqf0lk4ujmo	15279483	/api/external/userBalance	{"token": "ee5ad50447d158537bdce772762ff5a4", "user_id": "15279483", "agent_id": "178114", "timestamp": "1786057263128"}	{"msg": "Token expired", "code": 4, "data": [], "count": 0}	4	Token Expired	\N	2026-08-06 23:01:03.499
cmsi4dotl000du5zn08eik6pa	cmr69xaxy0000yfqf0lk4ujmo	15279483	/api/external/userBalance	{"token": "1b61a8e5f9b57b9d0cbf1f4babdf8dcc", "user_id": "15279483", "agent_id": "178114", "timestamp": "1786057263"}	{"msg": "Success", "code": 0, "data": {"user_balance": "5"}, "count": 0}	200	\N	\N	2026-08-06 23:01:03.849
cmsi4frev000fu5zn7x63mvlf	cmr69xaxy0000yfqf0lk4ujmo	15279483	/api/external/userBalance	{"token": "ca1ad613afccd11c46b07deb356e70ff", "user_id": "15279483", "agent_id": "178114", "timestamp": "1786057360"}	{"msg": "Success", "code": 0, "data": {"user_balance": "5"}, "count": 0}	200	\N	\N	2026-08-06 23:02:40.519
cmsicercl00032l32am6f4qg9	cmr69xaxy0000yfqf0lk4ujmo	15512904	/api/external/userBalance	{"token": "2ff73e694f3ee724d266a1dd0f24362d", "user_id": "15512904", "agent_id": "178114", "timestamp": "1786070750415"}	{"msg": "Token expired", "code": 4, "data": [], "count": 0}	4	Token Expired	\N	2026-08-07 02:45:50.709
cmsicermb00052l326bwx0yjv	cmr69xaxy0000yfqf0lk4ujmo	15512904	/api/external/userBalance	{"token": "8fa8d52ae53af78e869f408394b3c1f1", "user_id": "15512904", "agent_id": "178114", "timestamp": "1786070750"}	{"msg": "Success", "code": 0, "data": {"user_balance": "0"}, "count": 0}	200	\N	\N	2026-08-07 02:45:51.06
\.


--
-- Data for Name: ProviderTransaction; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ProviderTransaction" (id, "providerId", "userId", type, amount, "orderId", "providerOrderId", status, "createdAt", "updatedAt") FROM stdin;
cmr7cocjt0015ozy9z76ccl8a	cmr69xaxy0000yfqf0lk4ujmo	cmr7cl0hc000fozy9nbyyy76r	recharge	5	TX_1783229282432_3tube	\N	success	2026-07-04 23:58:07.817	2026-07-04 23:58:07.817
cmr7dlfg6000ruv755druq1ji	cmr69xaxy0000yfqf0lk4ujmo	cmr7cl0hc000fozy9nbyyy76r	recharge	5	TX_1783230826172_l8s0e	\N	success	2026-07-05 00:23:51.222	2026-07-05 00:23:51.222
cmr7fnqn3000q7di6is13eslu	cmr69xaxy0000yfqf0lk4ujmo	cmr7cl0hc000fozy9nbyyy76r	recharge	10	TX_1783234293253_j9228	\N	success	2026-07-05 01:21:38.271	2026-07-05 01:21:38.271
cmr7gz5dg000mtdkand86jw3b	cmr69xaxy0000yfqf0lk4ujmo	cmr7cl0hc000fozy9nbyyy76r	recharge	10	TX_1783236505093_uzvkn	\N	success	2026-07-05 01:58:30.196	2026-07-05 01:58:30.196
cmr7ktl95000ynggfqy7bkdkj	cmr69xaxy0000yfqf0lk4ujmo	cmr6b50aw0003mn9sssynf9dg	recharge	5	TX_1783242964178_rq5i1	\N	success	2026-07-05 03:46:09.305	2026-07-05 03:46:09.305
cmr7kv9k9001gnggfqotyuol9	cmr5ffgpe000mqs55ym8xwjyg	cmr6b50aw0003mn9sssynf9dg	recharge	5	TX_1783243042290_38lno	\N	success	2026-07-05 03:47:27.465	2026-07-05 03:47:27.465
cmr8wrmdi000td1fmgunou9gd	cmr69xaxy0000yfqf0lk4ujmo	cmr7cl0hc000fozy9nbyyy76r	recharge	5	TX_1783323493008_8fy96	\N	success	2026-07-06 02:08:19.014	2026-07-06 02:08:19.014
cmr8ww02l0015d1fm0kgom0f4	cmr69xaxy0000yfqf0lk4ujmo	cmr7cl0hc000fozy9nbyyy76r	recharge	5	TX_1783323697389_0xuhu	\N	success	2026-07-06 02:11:43.389	2026-07-06 02:11:43.389
cmrawlwno003ed1fmxnfd6c60	cmr69xaxy0000yfqf0lk4ujmo	cmravwyxd001yd1fmakz8rtio	recharge	5	TX_1783444159808_mtyf7	\N	success	2026-07-07 11:39:24.756	2026-07-07 11:39:24.756
cmray9o9r004jd1fmln82wbos	cmr7lwt20002rnggfbn8d7kil	cmravwyxd001yd1fmakz8rtio	recharge	50	TX_1783446948194_xouyk	\N	success	2026-07-07 12:25:53.247	2026-07-07 12:25:53.247
cmre473ev001ezv5iqw73uoav	cmr5fjihw000vqs55y8i87kv5	cmravwyxd001yd1fmakz8rtio	recharge	2	TX_1783638305104_217kt	\N	success	2026-07-09 17:35:09.127	2026-07-09 17:35:09.127
cmrhp61rd000bunsxko7dej43	cmr69xaxy0000yfqf0lk4ujmo	cmr69jqsu000012lh99aj857o	recharge	10	TX_1783854929594_t48qx	\N	success	2026-07-12 11:15:30.793	2026-07-12 11:15:30.793
cmrhp78in000xunsxchc8ulef	cmr7lwt20002rnggfbn8d7kil	cmr69jqsu000012lh99aj857o	recharge	10	TX_1783854984905_u879s	\N	success	2026-07-12 11:16:26.207	2026-07-12 11:16:26.207
cms53boxl000w4zzf4mzj8b4s	cmr69xaxy0000yfqf0lk4ujmo	cmr7cl0hc000fozy9nbyyy76r	recharge	5	TX_1785269429513_afhql	\N	success	2026-07-28 20:10:30.778	2026-07-28 20:10:30.778
cmsdp50ca000fcvkx0unmb77l	cmr69xaxy0000yfqf0lk4ujmo	cmr69jqsu000012lh99aj857o	recharge	5	TX_1785789798652_1a2oo	\N	success	2026-08-03 20:43:19.93	2026-08-03 20:43:19.93
\.


--
-- Data for Name: ProviderUser; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ProviderUser" (id, "userId", "providerId", "providerUserId", "accountName", "createdAt", "updatedAt") FROM stdin;
cmr7cm74a000mozy9jk4h1dh1	cmr7cl0hc000fozy9nbyyy76r	cmr69xaxy0000yfqf0lk4ujmo	15277896	laurelanna	2026-07-04 23:56:27.466	2026-07-04 23:56:27.466
cmr7kt41t000onggfnt7jmxx8	cmr6b50aw0003mn9sssynf9dg	cmr69xaxy0000yfqf0lk4ujmo	15279483	annalaurel_9575	2026-07-05 03:45:47.01	2026-07-05 03:45:47.01
cmr7kun7e0016nggfq6pp16r7	cmr6b50aw0003mn9sssynf9dg	cmr5ffgpe000mqs55ym8xwjyg	1485006	annalaurel_pl12	2026-07-05 03:46:58.491	2026-07-05 03:46:58.491
cmr7wsunt000s1bi4ubwu2mh0	cmr7wsqno000l1bi4298085zy	cmr5fjihw000vqs55y8i87kv5	15281512	wxfmmscaivoyxscolvae	2026-07-05 09:21:30.233	2026-07-05 09:21:30.233
cmr8usjyb000bd1fm2kser9ay	cmr69jqsu000012lh99aj857o	cmr69xaxy0000yfqf0lk4ujmo	15290343	admin_1448	2026-07-06 01:13:03.299	2026-07-06 01:13:03.299
cmravx4fj0029d1fms1nwvkrp	cmravwyxd001yd1fmakz8rtio	cmr5fjihw000vqs55y8i87kv5	15305663	rad_3985	2026-07-07 11:20:08.431	2026-07-07 11:20:08.431
cmraw3jj0002rd1fmh7112ehn	cmravwyxd001yd1fmakz8rtio	cmr69xaxy0000yfqf0lk4ujmo	15305688	rad_5765	2026-07-07 11:25:07.932	2026-07-07 11:25:07.932
cmraxvbra003vd1fmt9k4oveq	cmravwyxd001yd1fmakz8rtio	cmr7lwt20002rnggfbn8d7kil	16787623	rad	2026-07-07 12:14:43.846	2026-07-07 12:14:43.846
cmrgtv1kj000pcyz8f30wxev6	cmrgtuww2000ecyz8yx2kxdgc	cmr5fjihw000vqs55y8i87kv5	15355882	player001_4007	2026-07-11 15:09:09.236	2026-07-11 15:09:09.236
cmrgvgwpq001acyz8l0q2plo7	cmrgtuww2000ecyz8yx2kxdgc	cmr69xaxy0000yfqf0lk4ujmo	15356308	player001_2967	2026-07-11 15:54:08.99	2026-07-11 15:54:08.99
cmrhmnw47000qwtnprw75oskv	cmr7cl0hc000fozy9nbyyy76r	cmr7lwt20002rnggfbn8d7kil	16820358	laurelanna	2026-07-12 10:05:24.439	2026-07-12 10:05:24.439
cmrhp721w000punsx9xyxo07u	cmr69jqsu000012lh99aj857o	cmr7lwt20002rnggfbn8d7kil	16820892	admin_6741	2026-07-12 11:16:17.829	2026-07-12 11:16:17.829
cmrl919ii000iewlsnmghqic8	cmrl918qv000dewlsc0aahtul	cmr5fjihw000vqs55y8i87kv5	15394699	xxotzdjmsxhqcbogxn	2026-07-14 22:54:58.411	2026-07-14 22:54:58.411
cmrwv9eqw000c3ob42ds07lqa	cmrwv9dqh00053ob4acsc06ij	cmr5fjihw000vqs55y8i87kv5	15477214	mzjadpxuhpboebwgykbi	2026-07-23 02:02:37.928	2026-07-23 02:02:37.928
cmrybmn4t000l3ob4j4e372ys	cmrybmmg4000g3ob4072jsqzx	cmr5fjihw000vqs55y8i87kv5	15484152	uaxphsdhmyfmnibpawj	2026-07-24 02:28:35.357	2026-07-24 02:28:35.357
cmrzux4ui000ojaf77bm5mvz9	cmrzux2od000hjaf7c898t593	cmr5fjihw000vqs55y8i87kv5	15491115	pvlpmurjenfianlqfvzs	2026-07-25 04:16:23.754	2026-07-25 04:16:23.754
cms2vwl430010jaf7srz6bncs	cmr6b50aw0003mn9sssynf9dg	cmr5fjihw000vqs55y8i87kv5	15509387	annalaurel_6192	2026-07-27 07:07:16.323	2026-07-27 07:07:16.323
cms3gntoy000g30c0bv2tnd7c	cms3gns5x000530c0xul9v2ea	cmr5fjihw000vqs55y8i87kv5	15512848	aaa_4672	2026-07-27 16:48:19.475	2026-07-27 16:48:19.475
cms3h1i43000z30c0ajdunwiu	cms3gns5x000530c0xul9v2ea	cmr69xaxy0000yfqf0lk4ujmo	15512904	aaa_5356	2026-07-27 16:58:57.651	2026-07-27 16:58:57.651
cms7jkcjx000c1354yctbzivu	cms7jkbiu00051354c1gpeu4h	cmr5fjihw000vqs55y8i87kv5	15534552	ceseds	2026-07-30 13:20:40.845	2026-07-30 13:20:40.845
cmsfvhl9y000g7y6fae7o5ogg	cmr69jqsu000012lh99aj857o	cmsfvgxvr00087y6fy1hmp5x7	usr_admin	admin	2026-08-05 09:16:36.982	2026-08-05 09:16:36.982
cmsg81pfu0009at3a7cbkx58a	cmravwyxd001yd1fmakz8rtio	cmsfvgxvr00087y6fy1hmp5x7	usr_rad	rad	2026-08-05 15:08:10.891	2026-08-05 15:08:10.891
cmshbkj0j0012at3a2n5i5hrg	cmrgtuww2000ecyz8yx2kxdgc	cmsfvgxvr00087y6fy1hmp5x7	usr_player001	player001	2026-08-06 09:34:34.051	2026-08-06 09:34:34.051
\.


--
-- Data for Name: Setting; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Setting" (id, key, value, type, "group", "updatedAt") FROM stdin;
cmr69jtsn000s12lhsa31cauq	site_name	Vault Sweeps	string	general	2026-07-20 21:13:26.733
48a76ce5-8720-444d-98e3-9afc1039dc0b	site_tagline	The Ultimate Gaming Platform	string	general	2026-07-20 21:13:26.733
cmr69jtsn000t12lhxbigr0u3	site_description	The Ultimate Gaming Platform	string	general	2026-07-20 21:13:26.733
cmr69jtsn000u12lhyrc99ups	maintenance_mode	false	boolean	general	2026-07-20 21:13:26.733
cmr69jtsn000x12lhv481j8zk	telegram_url	https://t.me/Nicksweeps_bot	string	social	2026-07-20 21:13:26.733
cmr69jtsn000y12lhs17tensu	facebook_url	https://m.me/Vaultsweeps	string	social	2026-07-20 21:13:26.733
cmr69jtsn000v12lhiwm02fib	min_deposit	10	number	payments	2026-07-20 21:13:26.733
987512cd-d1b6-490b-b365-20955e2bfc07	max_deposit	100000	string	general	2026-07-20 21:13:26.733
cmr69jtsn000w12lhta33fwdn	min_withdrawal	10	number	payments	2026-07-20 21:13:26.733
66ae413d-beeb-4fa4-96f0-750e4c79891e	max_withdrawal	100000	string	general	2026-07-20 21:13:26.733
48242603-b6d1-4e02-a32b-4e1bd9bd8468	withdrawal_fee_percent	0	string	general	2026-07-20 21:13:26.733
9a2568ff-757f-4e77-bc33-68c556bd40f8	auto_approve_deposits	false	string	general	2026-07-20 21:13:26.733
cc27dd55-f2c4-4899-aa01-487d73786c1a	email_on_deposit	true	string	general	2026-07-20 21:13:26.733
ec8fc9e0-c66c-4dce-a439-a1564ea1075e	email_on_withdrawal	true	string	general	2026-07-20 21:13:26.733
fcca1295-eaa9-4412-becf-4df670b06144	email_on_register	true	string	general	2026-07-20 21:13:26.733
a092e93f-28c4-408e-99b6-8b7c3d23ee73	notify_admin_on_deposit	true	string	general	2026-07-20 21:13:26.733
35bea18a-fa45-4e11-893a-9f95b8324468	notify_admin_on_withdrawal	true	string	general	2026-07-20 21:13:26.733
e797056c-3a12-4af0-b28c-d759dac0ded0	two_factor_required	false	string	general	2026-07-20 21:13:26.733
efe98fe1-a98d-41ad-b7cb-2b9777b75a61	ip_whitelist_admin		string	general	2026-07-20 21:13:26.733
7141dcbe-231c-4245-bf6f-cb6ece9b6d8c	max_login_attempts	5	string	general	2026-07-20 21:13:26.733
bbbd9eee-20e7-4c7c-a62e-8895a92d001f	session_timeout_hours	24	string	general	2026-07-20 21:13:26.733
\.


--
-- Data for Name: SupportTicket; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."SupportTicket" (id, "userId", subject, message, status, priority, category, "assignedTo", "closedAt", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: TicketReply; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."TicketReply" (id, "ticketId", "userId", message, "isAdmin", "createdAt") FROM stdin;
\.


--
-- Data for Name: TransactionLog; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."TransactionLog" (id, type, "entityId", "userId", amount, status, metadata, "createdAt") FROM stdin;
cmr7a9bih0004118gq80anwhk	deposit_created	cmr7a9awk0003118gof893m4n	cmr6b50aw0003mn9sssynf9dg	10	pending	\N	2026-07-04 22:50:27.401
cmr7aadyv000b118gzskbhytc	deposit_created	cmr7aadct000a118gqndqidn3	cmr6b50aw0003mn9sssynf9dg	10	pending	\N	2026-07-04 22:51:17.161
cmr7apc1v00031088qkgqhguh	withdrawal_rejected	cmr7amnp200078jwr0ehnb9a2	admin@nexusgaming.com	10	rejected	{"reason": "Duplicate request", "requestId": "WD-1003", "adminUsername": "admin@nexusgaming.com"}	2026-07-04 23:02:54.596
cmr7aw7ue0007conqq2318t3x	withdrawal_rejectd	cmr7avkvh0003conqjvkjshir	TM	10	rejected	{"reason": "Incorrect details", "agentName": "TM", "requestId": "WD-1004"}	2026-07-04 23:08:15.734
cmr7awyn9000dconqdniqkecu	withdrawal_approved	cmr7awsu40009conqoyeucd0q	TM	10	approved	{"reason": null, "agentName": "TM", "requestId": "WD-1005"}	2026-07-04 23:08:50.47
cmr7axjg0000gconq2ld22qpf	deposit_created	cmr7axixd000fconqesd0gb3m	cmr6b50aw0003mn9sssynf9dg	10	pending	\N	2026-07-04 23:09:17.424
cmr7cmqf4000rozy9jrh2e56t	deposit_created	cmr7cmoym000qozy9glxzqb81	cmr7cl0hc000fozy9nbyyy76r	10	pending	\N	2026-07-04 23:56:52.48
cmr7fmm44000a7di6ztkugbtt	deposit_created	cmr7fmkc500097di6nl47wdb8	cmr7cl0hc000fozy9nbyyy76r	10	pending	\N	2026-07-05 01:20:45.748
cmr7gy9ny0008tdkam789h4cx	deposit_created	cmr7gy7wm0007tdkayrjkjdfc	cmr7cl0hc000fozy9nbyyy76r	25	pending	\N	2026-07-05 01:57:49.103
cmr7kqhca000anggf9352am7k	deposit_created	cmr7kqfew0009nggf7xrhqjv1	cmr6b50aw0003mn9sssynf9dg	10	pending	\N	2026-07-05 03:43:44.06
cmrawgf61002yd1fmnnq2v8y2	deposit_created	cmrawgdbv002xd1fmvl544fds	cmravwyxd001yd1fmakz8rtio	10	pending	\N	2026-07-07 11:35:08.81
cmraxn06z003ld1fmjvtl6sbu	deposit_created	cmraxmyiz003kd1fmzv5x8unt	cmravwyxd001yd1fmakz8rtio	10	pending	\N	2026-07-07 12:08:15.611
cmraxw932003yd1fmupqbcttd	deposit_created	cmraxw7fw003xd1fmj1fr7afx	cmravwyxd001yd1fmakz8rtio	25	pending	\N	2026-07-07 12:15:27.039
cmraxzryy0045d1fmut04r132	deposit_created	cmraxzq890044d1fmj3x16akw	cmravwyxd001yd1fmakz8rtio	50	pending	\N	2026-07-07 12:18:11.482
cmrbu46hi000291gfxa2a33cq	deposit_created	cmrbu45te000191gf5gmrtt9z	cmr69jqsu000012lh99aj857o	10	pending	\N	2026-07-08 03:17:24.631
cmrbub09d000991gftqujttmw	deposit_created	cmrbuazj2000891gfs9jbfimw	cmr69jqsu000012lh99aj857o	10	pending	\N	2026-07-08 03:22:43.153
cmrbubsqc000g91gf3rgy4tas	deposit_created	cmrbubs3w000f91gfw917almx	cmr69jqsu000012lh99aj857o	10	pending	\N	2026-07-08 03:23:20.052
cmrbvfks800063y6sncus89w2	deposit_created	cmrbvfk5400053y6suvqb1wn0	cmr69jqsu000012lh99aj857o	10	pending	\N	2026-07-08 03:54:15.992
cmrcg1wkl00081uvabawost4q	deposit_created	cmrcg1vyd00071uvaue3lfngn	cmr69jqsu000012lh99aj857o	10	pending	\N	2026-07-08 13:31:30.021
cmrch0g35000f1uvaqam3l0md	deposit_created	cmrch0fce000e1uvagvxg8js0	cmr69jqsu000012lh99aj857o	10	pending	\N	2026-07-08 13:58:21.534
cmrch647g000m1uvadaqa9rvp	deposit_created	cmrch63ia000l1uvanlgpluoy	cmr69jqsu000012lh99aj857o	10	pending	\N	2026-07-08 14:02:46.157
cmrchqyo00004hloa73rn40le	deposit_created	cmrchqy4c0003hloaii1qbdg6	cmr69jqsu000012lh99aj857o	10	pending	\N	2026-07-08 14:18:58.752
cmrcjm6q6000gzv5irhz7ay7v	deposit_created	cmrcjm52x000fzv5ic28rt219	cmravwyxd001yd1fmakz8rtio	10	pending	\N	2026-07-08 15:11:15.151
cmrcjmwd4000lzv5iqo5urr31	deposit_created	cmrcjmuqc000kzv5iikfsb7rr	cmr6b50aw0003mn9sssynf9dg	10	pending	\N	2026-07-08 15:11:48.377
cmrcjs45n0000b4kfdcutb4o2	deposit_approved	cmrcjmuqc000kzv5iikfsb7rr	cmr6b50aw0003mn9sssynf9dg	10	approved	{"method": "chime", "sender": "Phyllis B", "source": "imap_auto_verify"}	2026-07-08 15:15:51.755
cmrddlpo3000wzv5ir0qevc07	deposit_created	cmrddlo0g000vzv5i7s3erzpc	cmr6b50aw0003mn9sssynf9dg	10	pending	\N	2026-07-09 05:10:41.523
cmrddns9200004vil1z1yjjwc	deposit_approved	cmrddlo0g000vzv5i7s3erzpc	cmr6b50aw0003mn9sssynf9dg	10	approved	{"method": "chime", "sender": "Luz C", "source": "imap_auto_verify"}	2026-07-09 05:12:18.182
cmrgr6mqp0002cyz80i8qhfee	deposit_created	cmrgr6l2o0001cyz8fs7trvss	cmr69jqsu000012lh99aj857o	18	pending	\N	2026-07-11 13:54:11.041
cmrgrgi950002w7eyzp9un9l5	deposit_created	cmrgrgho40001w7eyy5ersy6b	cmr69jqsu000012lh99aj857o	18	pending	\N	2026-07-11 14:01:51.786
cmrgrhhii0005w7eyg6chqt64	deposit_approved	cmrgrgho40001w7eyy5ersy6b	cmr69jqsu000012lh99aj857o	18	approved	{"method": "chime", "sender": "Melinda S", "source": "imap_auto_verify"}	2026-07-11 14:02:37.482
cmrgriosm0008w7ey25waqt3s	deposit_created	cmrgrioa10007w7eymdv8pbn2	cmr69jqsu000012lh99aj857o	18	pending	\N	2026-07-11 14:03:33.575
cmrgs4kw70002skz95lnaxr48	deposit_created	cmrgs4k8i0001skz9kgkr5dd9	cmr69jqsu000012lh99aj857o	20	pending	\N	2026-07-11 14:20:34.951
cmrgs6j4a000bskz9l3mivi39	deposit_created	cmrgs6ile000askz9jq9ezmo9	cmr69jqsu000012lh99aj857o	10	pending	\N	2026-07-11 14:22:05.962
cmrgtw8qa000ucyz8ynmgg3kq	deposit_created	cmrgtw70d000tcyz8v7wlnq27	cmrgtuww2000ecyz8yx2kxdgc	25	pending	\N	2026-07-11 15:10:05.17
cmrhpfmgj00078hmhyhyzbc34	withdrawal_approved	cmrhpez9000038hmhlkwitxr1	TM	10	approved	{"reason": null, "agentName": "TM", "requestId": "WD-20260712-BETTWWSV"}	2026-07-12 11:22:57.524
cmrhq51qn0005ptpl7sy22t3f	withdrawal_rejectd	cmrhq4h7i0001ptpl834k5wc3	TM	5	rejected	{"reason": "Incorrect details", "agentName": "TM", "requestId": "WD-20260712-40M7KEA4"}	2026-07-12 11:42:43.728
cmrhq64bl001cunsxirzog06v	deposit_created	cmrhq63nm001bunsxbrkb9cti	cmr69jqsu000012lh99aj857o	10	pending	\N	2026-07-12 11:43:33.729
cmrhqo9cs000712i3vmr649s2	withdrawal_rejectd	cmrhqntnt000312i3h4n1qq62	TM	9	rejected	{"reason": "Incorrect details", "agentName": "TM", "requestId": "WD-20260712-Y8B6X0CY"}	2026-07-12 11:57:40.06
cmrqz6vj0000611m6drqiw3b8	deposit_created	cmrqz6syk000511m6gczs5gpc	cmr69jqsu000012lh99aj857o	10	pending	\N	2026-07-18 23:06:00.858
cmrr1velx000i10ff8puens06	deposit_created	cmrr1ve41000h10ffkmczc3ud	cmr6b50aw0003mn9sssynf9dg	10	pending	\N	2026-07-19 00:21:04.822
cmrr29gu8000812lgj2it7a3f	deposit_created	cmrr29gdo000712lg9kvpc932	cmr6b50aw0003mn9sssynf9dg	10	pending	\N	2026-07-19 00:32:00.896
cmrrqpy3y000fypvwlpn37yk6	withdrawal_approved	cmrrqplxm000bypvwwnw7wb1m	TM	5	approved	{"reason": null, "agentName": "TM", "requestId": "WD-20260719-446LMAS5"}	2026-07-19 11:56:40.558
cms2w09ih00026wjsyufbf46u	deposit_created	cms2w079400016wjsvn5g3jrq	cmr69jqsu000012lh99aj857o	5	pending	\N	2026-07-27 07:10:07.913
cms2w21xr000c6wjsgkmtsk1y	withdrawal_rejectd	cms2w1gb000086wjsf7sy5iqc	Admin	9	rejected	{"reason": "Incorrect details", "agentName": "Admin", "requestId": "WD-20260727-CLTD7M48"}	2026-07-27 07:11:31.408
cms2w59r0000i6wjsmfxshjel	withdrawal_rejectd	cms2w28qi000e6wjssu1b30hl	Admin	9	rejected	{"reason": "Bank information invalid", "agentName": "Admin", "requestId": "WD-20260727-5HB26U9N"}	2026-07-27 07:14:01.5
cms2w900j000l6wjsk0fztzbm	deposit_created	cms2w8xrd000k6wjs0x6nkva9	cmr69jqsu000012lh99aj857o	10	pending	\N	2026-07-27 07:16:55.507
cms2wb82b000v6wjsvgz0jm8y	withdrawal_rejectd	cms2w9vsk000r6wjsoaeiejge	Admin	9	rejected	{"reason": null, "agentName": "Admin", "requestId": "WD-20260727-1CVIROX6"}	2026-07-27 07:18:39.251
cms2wceuq000y6wjs0n5xtyoj	deposit_created	cms2wcclr000x6wjsrochuuax	cmr69jqsu000012lh99aj857o	10	pending	\N	2026-07-27 07:19:34.706
cms3gqhcy000n30c0cvd4pwly	deposit_created	cms3gqgw5000m30c0doudlsie	cms3gns5x000530c0xul9v2ea	15	pending	\N	2026-07-27 16:50:23.458
cms3j1v6g001830c0nbu4f86a	deposit_created	cms3j1upm001730c0pwk67c4q	cmr7cl0hc000fozy9nbyyy76r	10	pending	\N	2026-07-27 17:55:13.817
cms3jhfuo001d30c0yn9rck63	deposit_created	cms3jhfdu001c30c0h8ntfwyq	cmr7cl0hc000fozy9nbyyy76r	10	pending	\N	2026-07-27 18:07:20.449
cms3jjmdv001i30c01wmnhmgx	deposit_created	cms3jjlwz001h30c0upwmns6x	cmr7cl0hc000fozy9nbyyy76r	5	pending	\N	2026-07-27 18:09:02.227
cms3kewd600024zzfs501j3y4	deposit_created	cms3kevve00014zzf0txuyz1w	cmr7cl0hc000fozy9nbyyy76r	10	pending	\N	2026-07-27 18:33:21.498
cms53e36100144zzfulzzokzs	withdrawal_approved	cms53dvbq00124zzf0b753s3c	Admin	30	approved	{"reason": null, "agentName": "Admin", "requestId": "WD-20260728-BGY7ZDMW"}	2026-07-28 20:12:22.537
cmsc3lm7n000679uf3sjyymjr	deposit_created	cmsc3liw4000579ufe7m4d1yx	cmr6b50aw0003mn9sssynf9dg	10	pending	\N	2026-08-02 17:52:37.042
cmsdo5i870004kutg5sx2xc0e	deposit_created	cmsdo5hqf0003kutgie86yd7i	cmr69jqsu000012lh99aj857o	10	pending	\N	2026-08-03 20:15:43.495
cmsdsm2m800044w61jiek97a2	deposit_created	cmsdsm1ea00034w61wxjn9sxi	cmr69jqsu000012lh99aj857o	10	pending	\N	2026-08-03 22:20:34.88
cmshbjrpd000sat3axr5ut2o9	deposit_created	cmshbjr72000rat3af3x077li	cmrgtuww2000ecyz8yx2kxdgc	10	pending	\N	2026-08-06 09:33:58.658
\.


--
-- Data for Name: User; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."User" (id, username, email, password, role, "isVerified", "isActive", "isBanned", "verifyToken", "resetToken", "resetExpiry", "lastLogin", "referralCode", "promoCode", "createdAt", "updatedAt", "referredById") FROM stdin;
cmr7wsqno000l1bi4298085zy	wXfmMscAIVoYXscoLvAe	ibovepan86@gmail.com	$2a$10$tOvShZv/deL1RkuXF36u8OUbL6MPqKrZbQFdb2mqeNaVD8Cspf31i	user	f	t	f	ad40a4893a295bff1e7f9018eb84a261f64288cbfcc55f5e2f3d74d6df5a6f6b	\N	\N	\N	\N	\N	2026-07-05 09:21:25.044	2026-07-05 09:21:25.044	\N
cmr6b50aw0003mn9sssynf9dg	annalaurel_pl12	jolenepreze@gmail.com	$2a$10$0SksMbSntap1GJLR2dWP4eMW4uc6bmfz9CCpJ3MTn7IT43zpUJnOO	user	t	t	f	\N	\N	\N	2026-08-06 23:00:55.743	VSANNALDDAE50	\N	2026-07-04 06:27:19.688	2026-08-06 23:00:55.748	\N
cms3gns5x000530c0xul9v2ea	Aaa	jammeyy44@gmail.com	$2a$10$4pphxIOif7niwFzrh9.iT.ilel3QgfqzuCieh3oyKNoGIKBaFbNZu	user	f	t	f	3b3239e4e29a8507f8db76714c22a4ca12aee0907de68195b9d0164a89d947e9	\N	\N	2026-08-07 02:45:05.83	VSAAA6A81D8	\N	2026-07-27 16:48:17.493	2026-08-07 02:45:05.837	\N
cmravwyxd001yd1fmakz8rtio	rad	radilee61@gmail.com	$2a$10$dDDveD3w/BFALkEK9AlCUetFji6Q2q4Hh/4zWfsCEZGcMGukRUCkS	user	f	t	f	afc4e277f9d148ba6e4729d9bb8bd6898c0af6e29d784c1933d385f9e3091630	\N	\N	2026-08-05 06:40:46.169	VSRAD32E81B	\N	2026-07-07 11:20:01.297	2026-08-05 06:40:46.172	\N
cmrl918qv000dewlsc0aahtul	xxOTZDjmSxHQCBOGXn	kezaxapug721@gmail.com	$2a$10$3dhR9OWrGYzw5MUk9Ylz3OD/ZlU2cwbL1Glru.2b5DPEP7Qg1ENf.	user	f	t	f	c7311660969a65e9c7affdf628e87f41326b68e02dffbd138f52b5d378e5ac09	\N	\N	\N	\N	\N	2026-07-14 22:54:57.415	2026-07-14 22:54:57.415	\N
cmr7cl0hc000fozy9nbyyy76r	Laurelanna	laurelann635@gmail.com	$2a$10$Z.ms8PiQebb6WFGwDZrOF.MDpvc4OV.D4IBqMiyZT5st9vYU/fHqG	user	t	t	f	\N	\N	\N	2026-07-27 17:51:45.563	VSLAURE95DD17	\N	2026-07-04 23:55:32.208	2026-07-27 17:51:45.567	\N
cms7jkbiu00051354c1gpeu4h	ceseds	cedsdc@fdf.fe	$2a$10$YzKQXbbc8SOk6JKrlwYCxuQnYC2DO7cWdgIC3yIezplmIt7SUdRqy	user	f	t	f	36cfab47403abc2e65b773aa0c88e382ce78aafb3440826a0f4d8b2c470b95aa	\N	\N	2026-07-30 13:20:44.357	\N	\N	2026-07-30 13:20:39.51	2026-07-30 13:20:44.36	\N
cmrgtuww2000ecyz8yx2kxdgc	player001	imdineshgupta06@gmail.com	$2a$10$bPYt.KqJMwCei7EXeHeLUOP8O/R1Tp8ClFQtwOremTi/FOHlYWNaK	user	f	t	f	7704e0d60b3784f29190dd5787d8a809817e054d27514ef52e617412f4df7df0	\N	\N	2026-08-06 09:44:12.465	VSPLAYE37EA7E	\N	2026-07-11 15:09:03.17	2026-08-06 09:44:12.474	cmr69jqsu000012lh99aj857o
cmrqzvdm100056ihjug2ahews	jolenepreze23	jolenepreze23@gmail.com	$2a$10$pahendTItQ44h2S65oyRTOU6bRxNbBBc4iyYLvqKhLMI0d2fNpCvG	user	f	t	f	8f80494ae5dc7e7d4ccf383b4e559c84e4c30af2acf3e79412317d993643bacf	\N	\N	2026-07-18 23:25:25.485	\N	\N	2026-07-18 23:25:04.297	2026-07-18 23:25:25.49	\N
cmrwv9dqh00053ob4acsc06ij	MzJaDpxUHpBOEbWGYkbi	ijulunaler216@gmail.com	$2a$10$7GR4LmmZlVXOOH8Mrbdo0ul.ezAFuyf/zwr67gcIFUZjVXzKNYJ.q	user	f	t	f	7e68926d0e86100d497d4e64fa88e8d58123db874f946a151e9928adfd0fe7f0	\N	\N	\N	\N	\N	2026-07-23 02:02:36.617	2026-07-23 02:02:36.617	\N
cmrybmmg4000g3ob4072jsqzx	UAxPHSDHMyFmNiBpawJ	orabiregi784@gmail.com	$2a$10$ghjCiFm7K5w9GM1aI49pnuC5/fXCvTAo42mQ3VnVm4kPu4ZnWJLfe	user	f	t	f	01ea85f3dc727e39f0381e1932955f79cdf2a57a60858c82cee16bcac588efe5	\N	\N	\N	\N	\N	2026-07-24 02:28:34.468	2026-07-24 02:28:34.468	\N
cmrzux2od000hjaf7c898t593	PVlpmURjENfIANlQFvZS	tofulehasih993@gmail.com	$2a$10$RZud2Uny02wNsQuW4NzCReOWWaI7VSDV.N2HDa26l3uPXdpksRN02	user	f	t	f	149ecabd686eec35806627d569df66ad772c2d00c6db3e6718eed313d71f35e2	\N	\N	\N	\N	\N	2026-07-25 04:16:20.941	2026-07-25 04:16:20.941	\N
cmr69jqsu000012lh99aj857o	admin	admin@nexusgaming.com	$2a$12$hKEFdHNpMvuMgeizGthDqeLY5aRMJaEFM665epH6oaDmJH/9tX5Ja	admin	t	t	f	\N	\N	\N	2026-08-06 10:46:53.158	VSADMIND75B36	\N	2026-07-04 05:42:47.982	2026-08-06 10:46:53.161	\N
\.


--
-- Data for Name: UserProfile; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."UserProfile" (id, "userId", "fullName", phone, country, avatar, "telegramUsername", "telegramId", "telegramPhone") FROM stdin;
cmr69jqsu000112lhj8ae7tga	cmr69jqsu000012lh99aj857o	Platform Administrator	\N	\N	\N	\N	\N	\N
cmr7cl0hc000gozy9zq35bu1b	cmr7cl0hc000fozy9nbyyy76r	\N	\N	\N	\N	\N	\N	\N
cmr7wsqno000m1bi4i9t8xvhk	cmr7wsqno000l1bi4298085zy	\N	\N	\N	\N	\N	\N	\N
cmravwyxd001zd1fmsw2x0n74	cmravwyxd001yd1fmakz8rtio	\N	\N	\N	\N	\N	\N	\N
cmrgtuww2000fcyz8ztzjg1kr	cmrgtuww2000ecyz8yx2kxdgc	\N	\N	\N	\N	\N	\N	\N
cmrl918qv000eewlsprvboqlz	cmrl918qv000dewlsc0aahtul	\N	\N	\N	\N	\N	\N	\N
cmrqzvdm100066ihjj8g28w1z	cmrqzvdm100056ihjug2ahews	\N	\N	\N	\N	\N	\N	\N
cmrwv9dqh00063ob4tqj5ptvg	cmrwv9dqh00053ob4acsc06ij	\N	\N	\N	\N	\N	\N	\N
cmrybmmg4000h3ob4ipmcaj92	cmrybmmg4000g3ob4072jsqzx	\N	\N	\N	\N	\N	\N	\N
cmrzux2od000ijaf7sjba4xxg	cmrzux2od000hjaf7c898t593	\N	\N	\N	\N	\N	\N	\N
cms3gns5x000630c0q83885s6	cms3gns5x000530c0xul9v2ea	\N	\N	\N	\N	\N	\N	\N
cmr6b50aw0004mn9st62cxk9g	cmr6b50aw0003mn9sssynf9dg	\N	\N	\N	\N	\N	6359329105	\N
cms7jkbiu000613549vpjk9vx	cms7jkbiu00051354c1gpeu4h	\N	\N	\N	\N	\N	\N	\N
\.


--
-- Data for Name: Withdrawal; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Withdrawal" (id, "userId", amount, currency, "paymentMethodId", "accountInfo", status, "adminNotes", "processedBy", "processedAt", "requestId", "paymentMethodStr", "accountDetails", "approvedBy", "approvedAt", "rejectedBy", "rejectedAt", "rejectionReason", locked, "telegramMessageId", "telegramChatId", "createdAt", "updatedAt") FROM stdin;
cmr7awsu40009conqoyeucd0q	cmr6b50aw0003mn9sssynf9dg	10	USD	\N	jolene	approved	Chime	\N	\N	WD-1005	Chime	\N	TM	2026-07-04 23:08:49.344	\N	\N	\N	t	105	-1004364345845	2026-07-04 23:08:42.941	2026-07-04 23:08:49.348
cmrgv9gqs0001cwormrgozjcf	cmrgtuww2000ecyz8yx2kxdgc	10	USD	\N	Admin Void	paid	Admin Void: wrong payment	cmr69jqsu000012lh99aj857o	2026-07-11 15:48:21.697	\N	\N	\N	\N	\N	\N	\N	\N	f	\N	\N	2026-07-11 15:48:21.7	2026-07-11 15:48:21.7
cmrgvdhtg0003cwor6u3uy6zq	cmrgtuww2000ecyz8yx2kxdgc	15	USD	\N	Admin Void	paid	Admin Void: reverse fraud	cmr69jqsu000012lh99aj857o	2026-07-11 15:51:29.714	\N	\N	\N	\N	\N	\N	\N	\N	f	\N	\N	2026-07-11 15:51:29.716	2026-07-11 15:51:29.716
cmrhpez9000038hmhlkwitxr1	cmr69jqsu000012lh99aj857o	10	USD	\N	michael	approved	Chime	\N	\N	WD-20260712-BETTWWSV	Chime	\N	TM	2026-07-12 11:22:53.787	\N	\N	\N	t	203	-1004364345845	2026-07-12 11:22:27.445	2026-07-12 11:22:53.789
cmrhq4h7i0001ptpl834k5wc3	cmr69jqsu000012lh99aj857o	5	USD	\N	msdfghjugt	rejected	Chime	\N	\N	WD-20260712-40M7KEA4	Chime	\N	\N	\N	TM	2026-07-12 11:42:40.103	Incorrect details	t	205	-1004364345845	2026-07-12 11:42:17.118	2026-07-12 11:42:40.105
cmr7ab6cv000h118gbp25co1p	cmr6b50aw0003mn9sssynf9dg	10	USD	\N	$Cashtag: $jolene	rejected		\N	\N	WD-1001	Cash App	\N	\N	\N	\N	\N	\N	f	\N	\N	2026-07-04 22:51:54.031	2026-07-04 22:55:45.45
cmrrqplxm000bypvwwnw7wb1m	cmr6b50aw0003mn9sssynf9dg	5	USD	\N	gfdsdvfbxz	approved	Chime	\N	\N	WD-20260719-446LMAS5	Chime	\N	TM	2026-07-19 11:56:36.827	\N	\N	\N	t	225	-1004364345845	2026-07-19 11:56:24.778	2026-07-19 11:56:36.829
cmr7agzku0007d41dfxx64fvw	cmr6b50aw0003mn9sssynf9dg	10	USD	\N	$Cashtag: jolene	rejected		\N	\N	WD-1002	Cash App	\N	\N	\N	\N	\N	\N	f	\N	\N	2026-07-04 22:56:25.182	2026-07-04 23:00:17.607
cms2w1gb000086wjsf7sy5iqc	cmr69jqsu000012lh99aj857o	9	USD	\N	tfyutryty	rejected	Chime	\N	\N	WD-20260727-CLTD7M48	Chime	\N	\N	\N	Admin	2026-07-27 07:11:27.792	Incorrect details	t	263	-1004364345845	2026-07-27 07:11:03.372	2026-07-27 07:11:27.795
cmr7amnp200078jwr0ehnb9a2	cmr6b50aw0003mn9sssynf9dg	10	USD	\N	$Cashtag: jolene	rejected	Cash App	\N	\N	WD-1003	Cash App	\N	\N	\N	admin@nexusgaming.com	2026-07-04 23:02:53.749	Duplicate request	t	\N	\N	2026-07-04 23:00:49.718	2026-07-04 23:02:53.769
cms2w28qi000e6wjssu1b30hl	cmr69jqsu000012lh99aj857o	9	USD	\N	dfghujik	rejected	Chime	\N	\N	WD-20260727-5HB26U9N	Chime	\N	\N	\N	Admin	2026-07-27 07:13:57.913	Bank information invalid	t	266	-1004364345845	2026-07-27 07:11:40.218	2026-07-27 07:13:57.915
cmr7avkvh0003conqjvkjshir	cmr6b50aw0003mn9sssynf9dg	10	USD	\N	$Cashtag: jolene	rejected	Cash App	\N	\N	WD-1004	Cash App	\N	\N	\N	TM	2026-07-04 23:08:14.595	Incorrect details	t	102	-1004364345845	2026-07-04 23:07:45.965	2026-07-04 23:08:14.598
cms2w9vsk000r6wjsoaeiejge	cmr69jqsu000012lh99aj857o	9	USD	\N	dfghkjkh	rejected	Chime	\N	\N	WD-20260727-1CVIROX6	Chime	\N	\N	\N	Admin	2026-07-27 07:18:35.444	\N	t	271	-1004364345845	2026-07-27 07:17:36.691	2026-07-27 07:18:35.446
cms53dvbq00124zzf0b753s3c	cmr7cl0hc000fozy9nbyyy76r	30	USD	\N	$Cashtag: Nickjonas55	approved	Cash App	\N	\N	WD-20260728-BGY7ZDMW	Cash App	\N	Admin	2026-07-28 20:12:22.145	\N	\N	\N	t	291	-1004364345845	2026-07-28 20:12:12.374	2026-07-28 20:12:22.146
cmrhqntnt000312i3h4n1qq62	cmr69jqsu000012lh99aj857o	9	USD	\N	$Cashtag: tfyugihhugyf	rejected	Cash App	\N	\N	WD-20260712-Y8B6X0CY	Cash App	\N	\N	\N	TM	2026-07-12 11:57:39.014	Incorrect details	t	210	-1004364345845	2026-07-12 11:57:19.721	2026-07-12 11:57:39.015
\.


--
-- Name: ActivityLog ActivityLog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ActivityLog"
    ADD CONSTRAINT "ActivityLog_pkey" PRIMARY KEY (id);


--
-- Name: AdminWallet AdminWallet_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AdminWallet"
    ADD CONSTRAINT "AdminWallet_pkey" PRIMARY KEY (id);


--
-- Name: Announcement Announcement_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Announcement"
    ADD CONSTRAINT "Announcement_pkey" PRIMARY KEY (id);


--
-- Name: Banner Banner_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Banner"
    ADD CONSTRAINT "Banner_pkey" PRIMARY KEY (id);


--
-- Name: BonusClaim BonusClaim_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BonusClaim"
    ADD CONSTRAINT "BonusClaim_pkey" PRIMARY KEY (id);


--
-- Name: Bonus Bonus_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Bonus"
    ADD CONSTRAINT "Bonus_pkey" PRIMARY KEY (id);


--
-- Name: Conversation Conversation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Conversation"
    ADD CONSTRAINT "Conversation_pkey" PRIMARY KEY (id);


--
-- Name: DepositTransaction DepositTransaction_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DepositTransaction"
    ADD CONSTRAINT "DepositTransaction_pkey" PRIMARY KEY (id);


--
-- Name: Deposit Deposit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Deposit"
    ADD CONSTRAINT "Deposit_pkey" PRIMARY KEY (id);


--
-- Name: FAQ FAQ_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FAQ"
    ADD CONSTRAINT "FAQ_pkey" PRIMARY KEY (id);


--
-- Name: GameDownload GameDownload_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."GameDownload"
    ADD CONSTRAINT "GameDownload_pkey" PRIMARY KEY (id);


--
-- Name: Game Game_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Game"
    ADD CONSTRAINT "Game_pkey" PRIMARY KEY (id);


--
-- Name: Message Message_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Message"
    ADD CONSTRAINT "Message_pkey" PRIMARY KEY (id);


--
-- Name: Notification Notification_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Notification"
    ADD CONSTRAINT "Notification_pkey" PRIMARY KEY (id);


--
-- Name: PaymentMethod PaymentMethod_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PaymentMethod"
    ADD CONSTRAINT "PaymentMethod_pkey" PRIMARY KEY (id);


--
-- Name: PaymentWebhook PaymentWebhook_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PaymentWebhook"
    ADD CONSTRAINT "PaymentWebhook_pkey" PRIMARY KEY (id);


--
-- Name: ProviderBalanceHistory ProviderBalanceHistory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProviderBalanceHistory"
    ADD CONSTRAINT "ProviderBalanceHistory_pkey" PRIMARY KEY (id);


--
-- Name: ProviderLog ProviderLog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProviderLog"
    ADD CONSTRAINT "ProviderLog_pkey" PRIMARY KEY (id);


--
-- Name: ProviderTransaction ProviderTransaction_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProviderTransaction"
    ADD CONSTRAINT "ProviderTransaction_pkey" PRIMARY KEY (id);


--
-- Name: ProviderUser ProviderUser_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProviderUser"
    ADD CONSTRAINT "ProviderUser_pkey" PRIMARY KEY (id);


--
-- Name: Provider Provider_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Provider"
    ADD CONSTRAINT "Provider_pkey" PRIMARY KEY (id);


--
-- Name: Setting Setting_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Setting"
    ADD CONSTRAINT "Setting_pkey" PRIMARY KEY (id);


--
-- Name: SupportTicket SupportTicket_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SupportTicket"
    ADD CONSTRAINT "SupportTicket_pkey" PRIMARY KEY (id);


--
-- Name: TicketReply TicketReply_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TicketReply"
    ADD CONSTRAINT "TicketReply_pkey" PRIMARY KEY (id);


--
-- Name: TransactionLog TransactionLog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TransactionLog"
    ADD CONSTRAINT "TransactionLog_pkey" PRIMARY KEY (id);


--
-- Name: UserProfile UserProfile_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserProfile"
    ADD CONSTRAINT "UserProfile_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: Withdrawal Withdrawal_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Withdrawal"
    ADD CONSTRAINT "Withdrawal_pkey" PRIMARY KEY (id);


--
-- Name: ActivityLog_userId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ActivityLog_userId_createdAt_idx" ON public."ActivityLog" USING btree ("userId", "createdAt");


--
-- Name: ActivityLog_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ActivityLog_userId_idx" ON public."ActivityLog" USING btree ("userId");


--
-- Name: Banner_isActive_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Banner_isActive_order_idx" ON public."Banner" USING btree ("isActive", "order");


--
-- Name: BonusClaim_userId_bonusId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "BonusClaim_userId_bonusId_key" ON public."BonusClaim" USING btree ("userId", "bonusId");


--
-- Name: BonusClaim_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BonusClaim_userId_idx" ON public."BonusClaim" USING btree ("userId");


--
-- Name: Conversation_conversation_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Conversation_conversation_id_idx" ON public."Conversation" USING btree (conversation_id);


--
-- Name: Conversation_conversation_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Conversation_conversation_id_key" ON public."Conversation" USING btree (conversation_id);


--
-- Name: Conversation_telegram_thread_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Conversation_telegram_thread_id_idx" ON public."Conversation" USING btree (telegram_thread_id);


--
-- Name: DepositTransaction_depositId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "DepositTransaction_depositId_key" ON public."DepositTransaction" USING btree ("depositId");


--
-- Name: DepositTransaction_transactionRef_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "DepositTransaction_transactionRef_key" ON public."DepositTransaction" USING btree ("transactionRef");


--
-- Name: Deposit_paymentReference_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Deposit_paymentReference_key" ON public."Deposit" USING btree ("paymentReference");


--
-- Name: Deposit_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Deposit_status_idx" ON public."Deposit" USING btree (status);


--
-- Name: Deposit_userId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Deposit_userId_status_idx" ON public."Deposit" USING btree ("userId", status);


--
-- Name: GameDownload_userId_gameId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "GameDownload_userId_gameId_key" ON public."GameDownload" USING btree ("userId", "gameId");


--
-- Name: Game_category_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Game_category_idx" ON public."Game" USING btree (category);


--
-- Name: Game_isFeatured_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Game_isFeatured_idx" ON public."Game" USING btree ("isFeatured");


--
-- Name: Message_conversation_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Message_conversation_id_idx" ON public."Message" USING btree (conversation_id);


--
-- Name: Notification_userId_isRead_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Notification_userId_isRead_idx" ON public."Notification" USING btree ("userId", "isRead");


--
-- Name: PaymentMethod_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "PaymentMethod_code_key" ON public."PaymentMethod" USING btree (code);


--
-- Name: ProviderTransaction_orderId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ProviderTransaction_orderId_key" ON public."ProviderTransaction" USING btree ("orderId");


--
-- Name: ProviderTransaction_providerId_userId_type_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ProviderTransaction_providerId_userId_type_status_idx" ON public."ProviderTransaction" USING btree ("providerId", "userId", type, status);


--
-- Name: ProviderTransaction_userId_providerId_type_status_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ProviderTransaction_userId_providerId_type_status_createdAt_idx" ON public."ProviderTransaction" USING btree ("userId", "providerId", type, status, "createdAt" DESC);


--
-- Name: ProviderTransaction_userId_type_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ProviderTransaction_userId_type_status_idx" ON public."ProviderTransaction" USING btree ("userId", type, status);


--
-- Name: ProviderUser_providerId_providerUserId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ProviderUser_providerId_providerUserId_key" ON public."ProviderUser" USING btree ("providerId", "providerUserId");


--
-- Name: ProviderUser_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ProviderUser_userId_idx" ON public."ProviderUser" USING btree ("userId");


--
-- Name: ProviderUser_userId_providerId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ProviderUser_userId_providerId_key" ON public."ProviderUser" USING btree ("userId", "providerId");


--
-- Name: Setting_key_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Setting_key_key" ON public."Setting" USING btree (key);


--
-- Name: SupportTicket_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SupportTicket_status_idx" ON public."SupportTicket" USING btree (status);


--
-- Name: SupportTicket_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SupportTicket_userId_idx" ON public."SupportTicket" USING btree ("userId");


--
-- Name: TransactionLog_type_entityId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TransactionLog_type_entityId_idx" ON public."TransactionLog" USING btree (type, "entityId");


--
-- Name: UserProfile_userId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "UserProfile_userId_key" ON public."UserProfile" USING btree ("userId");


--
-- Name: User_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "User_email_idx" ON public."User" USING btree (email);


--
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);


--
-- Name: User_promoCode_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "User_promoCode_key" ON public."User" USING btree ("promoCode");


--
-- Name: User_referralCode_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "User_referralCode_idx" ON public."User" USING btree ("referralCode");


--
-- Name: User_referralCode_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "User_referralCode_key" ON public."User" USING btree ("referralCode");


--
-- Name: User_username_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "User_username_idx" ON public."User" USING btree (username);


--
-- Name: User_username_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "User_username_key" ON public."User" USING btree (username);


--
-- Name: Withdrawal_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Withdrawal_createdAt_idx" ON public."Withdrawal" USING btree ("createdAt");


--
-- Name: Withdrawal_requestId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Withdrawal_requestId_idx" ON public."Withdrawal" USING btree ("requestId");


--
-- Name: Withdrawal_requestId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Withdrawal_requestId_key" ON public."Withdrawal" USING btree ("requestId");


--
-- Name: Withdrawal_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Withdrawal_status_idx" ON public."Withdrawal" USING btree (status);


--
-- Name: Withdrawal_userId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Withdrawal_userId_status_idx" ON public."Withdrawal" USING btree ("userId", status);


--
-- Name: ActivityLog ActivityLog_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ActivityLog"
    ADD CONSTRAINT "ActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: BonusClaim BonusClaim_bonusId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BonusClaim"
    ADD CONSTRAINT "BonusClaim_bonusId_fkey" FOREIGN KEY ("bonusId") REFERENCES public."Bonus"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: BonusClaim BonusClaim_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BonusClaim"
    ADD CONSTRAINT "BonusClaim_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Conversation Conversation_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Conversation"
    ADD CONSTRAINT "Conversation_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: DepositTransaction DepositTransaction_depositId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DepositTransaction"
    ADD CONSTRAINT "DepositTransaction_depositId_fkey" FOREIGN KEY ("depositId") REFERENCES public."Deposit"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Deposit Deposit_paymentMethodId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Deposit"
    ADD CONSTRAINT "Deposit_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES public."PaymentMethod"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Deposit Deposit_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Deposit"
    ADD CONSTRAINT "Deposit_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: GameDownload GameDownload_gameId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."GameDownload"
    ADD CONSTRAINT "GameDownload_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES public."Game"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: GameDownload GameDownload_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."GameDownload"
    ADD CONSTRAINT "GameDownload_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Game Game_providerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Game"
    ADD CONSTRAINT "Game_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES public."Provider"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Message Message_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Message"
    ADD CONSTRAINT "Message_conversation_id_fkey" FOREIGN KEY (conversation_id) REFERENCES public."Conversation"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Notification Notification_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Notification"
    ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ProviderBalanceHistory ProviderBalanceHistory_providerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProviderBalanceHistory"
    ADD CONSTRAINT "ProviderBalanceHistory_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES public."Provider"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ProviderLog ProviderLog_providerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProviderLog"
    ADD CONSTRAINT "ProviderLog_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES public."Provider"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ProviderTransaction ProviderTransaction_providerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProviderTransaction"
    ADD CONSTRAINT "ProviderTransaction_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES public."Provider"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ProviderTransaction ProviderTransaction_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProviderTransaction"
    ADD CONSTRAINT "ProviderTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ProviderUser ProviderUser_providerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProviderUser"
    ADD CONSTRAINT "ProviderUser_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES public."Provider"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ProviderUser ProviderUser_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProviderUser"
    ADD CONSTRAINT "ProviderUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SupportTicket SupportTicket_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SupportTicket"
    ADD CONSTRAINT "SupportTicket_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: TicketReply TicketReply_ticketId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TicketReply"
    ADD CONSTRAINT "TicketReply_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES public."SupportTicket"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TicketReply TicketReply_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TicketReply"
    ADD CONSTRAINT "TicketReply_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: UserProfile UserProfile_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserProfile"
    ADD CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: User User_referredById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_referredById_fkey" FOREIGN KEY ("referredById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Withdrawal Withdrawal_paymentMethodId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Withdrawal"
    ADD CONSTRAINT "Withdrawal_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES public."PaymentMethod"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Withdrawal Withdrawal_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Withdrawal"
    ADD CONSTRAINT "Withdrawal_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ActivityLog; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."ActivityLog" ENABLE ROW LEVEL SECURITY;

--
-- Name: AdminWallet; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."AdminWallet" ENABLE ROW LEVEL SECURITY;

--
-- Name: Announcement; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Announcement" ENABLE ROW LEVEL SECURITY;

--
-- Name: Banner; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Banner" ENABLE ROW LEVEL SECURITY;

--
-- Name: Bonus; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Bonus" ENABLE ROW LEVEL SECURITY;

--
-- Name: BonusClaim; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."BonusClaim" ENABLE ROW LEVEL SECURITY;

--
-- Name: Conversation; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Conversation" ENABLE ROW LEVEL SECURITY;

--
-- Name: Deposit; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Deposit" ENABLE ROW LEVEL SECURITY;

--
-- Name: DepositTransaction; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."DepositTransaction" ENABLE ROW LEVEL SECURITY;

--
-- Name: FAQ; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."FAQ" ENABLE ROW LEVEL SECURITY;

--
-- Name: Game; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Game" ENABLE ROW LEVEL SECURITY;

--
-- Name: GameDownload; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."GameDownload" ENABLE ROW LEVEL SECURITY;

--
-- Name: Message; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Message" ENABLE ROW LEVEL SECURITY;

--
-- Name: Notification; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Notification" ENABLE ROW LEVEL SECURITY;

--
-- Name: PaymentMethod; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."PaymentMethod" ENABLE ROW LEVEL SECURITY;

--
-- Name: PaymentWebhook; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."PaymentWebhook" ENABLE ROW LEVEL SECURITY;

--
-- Name: Provider; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Provider" ENABLE ROW LEVEL SECURITY;

--
-- Name: ProviderBalanceHistory; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."ProviderBalanceHistory" ENABLE ROW LEVEL SECURITY;

--
-- Name: ProviderLog; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."ProviderLog" ENABLE ROW LEVEL SECURITY;

--
-- Name: ProviderTransaction; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."ProviderTransaction" ENABLE ROW LEVEL SECURITY;

--
-- Name: ProviderUser; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."ProviderUser" ENABLE ROW LEVEL SECURITY;

--
-- Name: Setting; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Setting" ENABLE ROW LEVEL SECURITY;

--
-- Name: SupportTicket; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."SupportTicket" ENABLE ROW LEVEL SECURITY;

--
-- Name: TicketReply; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."TicketReply" ENABLE ROW LEVEL SECURITY;

--
-- Name: TransactionLog; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."TransactionLog" ENABLE ROW LEVEL SECURITY;

--
-- Name: User; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."User" ENABLE ROW LEVEL SECURITY;

--
-- Name: UserProfile; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."UserProfile" ENABLE ROW LEVEL SECURITY;

--
-- Name: Withdrawal; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Withdrawal" ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

\unrestrict 5xnv99sKgrvdScKRYYmaOZvkMFvPCqd1w2IwhaNZbD9iP4cmaCdoj65LbkRrpaI


