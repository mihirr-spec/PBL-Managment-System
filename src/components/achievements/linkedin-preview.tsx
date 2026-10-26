"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Globe,
  ImageOff,
  Link2,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  Repeat2,
  Send,
  ThumbsUp,
  Unlink,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/field";
import { useSession } from "@/lib/auth/session";
import { linkedInPost } from "@/lib/achievements";
import * as repo from "@/lib/data/repository";
import type { Achievement, LinkedInAccount } from "@/lib/types";
import { cn, formatDate, formatDateTime, initials } from "@/lib/utils";

/** LinkedIn's limit on post text. */
const MAX_LENGTH = 3000;
/** LinkedIn cuts a feed post here and shows "…more". */
const FOLD = 210;
/** Image types LinkedIn accepts in a post. */
const POSTABLE_IMAGE = /\.(png|jpe?g|gif)$/i;
/** Shown as the author until the PBL office connects the central account. */
const FALLBACK_AUTHOR = "MUJ PBL Office";

const REOPEN_KEY = "linkedin:preview";

/**
 * The achievement whose preview was open when the browser left to connect
 * LinkedIn, so the page can reopen it on the way back.
 */
export function pendingLinkedInPreview(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(REOPEN_KEY);
  } catch {
    return null;
  }
}

function clearPending() {
  try {
    window.sessionStorage.removeItem(REOPEN_KEY);
  } catch {}
}

/** The account with how long its connection has left, worked out when it loads. */
type LoadedAccount = LinkedInAccount & { daysLeft: number; expired: boolean };

/** The portal's central LinkedIn account; `undefined` while loading. */
function useLinkedInAccount() {
  const [account, setAccount] = useState<LoadedAccount | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    repo.getLinkedInAccount().then(
      (acc) => {
        if (!live) return;
        const ms = acc ? new Date(acc.expiresAt).getTime() - Date.now() : 0;
        setAccount(acc ? { ...acc, daysLeft: Math.ceil(ms / 86_400_000), expired: ms <= 0 } : null);
      },
      () => live && setAccount(null),
    );
    return () => {
      live = false;
    };
  }, []);
  return [account, setAccount] as const;
}

/** The supervisor's approval, held back until they have seen the post. */
export interface PendingApproval {
  note: string;
  marks: number;
}

/**
 * Full-screen preview of an achievement's LinkedIn post, drawn the way
 * LinkedIn shows it in the feed, beside the editor. Every post goes out from
 * the portal's central LinkedIn account, so teachers never handle its login.
 *
 * With `approval`, the supervisor is approving from here: "Approve and post"
 * records the approval and publishes in one step. Without it, the achievement
 * is already approved and "Post to LinkedIn" publishes it.
 */
export function LinkedInPreview({
  achievement: a,
  approval,
  onClose,
  onChanged,
}: {
  achievement: Achievement;
  approval?: PendingApproval;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { user } = useSession();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [text, setText] = useState(() => (a.student ? linkedInPost(a, a.student) : a.title));
  const images = useMemo(() => a.documents.filter((d) => POSTABLE_IMAGE.test(d.name)), [a.documents]);
  const [imagePath, setImagePath] = useState<string | null>(() => images[0]?.path ?? null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [account] = useLinkedInAccount();
  const [busy, setBusy] = useState<"approve" | "approve-post" | "post" | "connect" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [approvedHere, setApprovedHere] = useState(false);
  const [posted, setPosted] = useState<{ url: string } | null>(
    a.linkedIn ? { url: `https://www.linkedin.com/feed/update/${a.linkedIn.urn}/` } : null,
  );

  useEffect(() => {
    closeRef.current?.focus();
    clearPending();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  useEffect(() => {
    if (!imagePath) return;
    let live = true;
    repo.getFileUrl("achievements", imagePath).then(
      (url) => live && setImageUrl(url),
      () => live && setImageUrl(null),
    );
    return () => {
      live = false;
    };
  }, [imagePath]);

  const connected = !!account && !account.expired;
  const tooLong = text.trim().length > MAX_LENGTH;
  const approving = !!approval && !approvedHere && a.status !== "approved";
  const isAdmin = user?.role === "admin";

  async function approve(): Promise<boolean> {
    if (!approval) return true;
    await repo.reviewAchievement(a.id, "approve", approval.note, approval.marks);
    setApprovedHere(true);
    onChanged();
    return true;
  }

  async function publish() {
    const result = await repo.postAchievementToLinkedIn(a.id, text.trim(), imagePath ?? undefined);
    setPosted({ url: result.url });
    onChanged();
  }

  async function run(kind: "approve" | "approve-post" | "post") {
    setBusy(kind);
    setError(null);
    let approvedNow = false;
    try {
      if (kind !== "post") approvedNow = await approve();
      if (kind !== "approve") await publish();
      if (kind === "approve") onClose();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Something went wrong.";
      setError(approvedNow ? `Approved, but the post did not go out: ${message}` : message);
    } finally {
      setBusy(null);
    }
  }

  async function connect() {
    setBusy("connect");
    setError(null);
    try {
      window.sessionStorage.setItem(REOPEN_KEY, a.id);
    } catch {}
    try {
      await repo.connectLinkedIn(window.location.pathname);
    } catch (e) {
      clearPending();
      setError(e instanceof Error ? e.message : "Could not start the LinkedIn sign-in.");
      setBusy(null);
    }
  }

  const linkedInButton = "w-full bg-[#0a66c2] text-white hover:bg-[#004182] active:bg-[#004182]";

  let actions: React.ReactNode;
  if (posted) {
    actions = (
      <div className="space-y-2">
        <p className="flex items-center gap-2 text-[13.5px] font-medium text-sage-500">
          <CheckCircle2 className="size-4" />
          {approvedHere ? "Approved and posted on LinkedIn" : "Posted on LinkedIn"}
        </p>
        {a.linkedIn ? (
          <p className="text-[12px] text-stone-500">
            By {a.linkedIn.postedBy || "staff"} · {formatDateTime(a.linkedIn.postedAt)}
          </p>
        ) : null}
        <a
          href={posted.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#0a66c2] hover:underline"
        >
          <ExternalLink className="size-3.5" />
          View the post
        </a>
      </div>
    );
  } else if (account === undefined) {
    actions = (
      <p className="flex items-center gap-2 text-[13px] text-stone-500">
        <Loader2 className="size-4 animate-spin" />
        Checking the portal&apos;s LinkedIn account…
      </p>
    );
  } else {
    const notConnected = (
      <p className="flex gap-2 text-[12.5px] leading-snug text-stone-600">
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-gold-600" />
        {account?.expired
          ? "The portal's LinkedIn connection has expired. The PBL office needs to connect it again before posts can go out."
          : "The portal's LinkedIn account is not connected yet. The PBL office connects it once."}
      </p>
    );
    actions = (
      <>
        {connected ? (
          <p className="text-[12.5px] text-stone-600">
            Posts from <span className="font-medium text-ink-900">{account.name || "the portal's LinkedIn"}</span>
          </p>
        ) : (
          notConnected
        )}

        {approving ? (
          <>
            {connected ? (
              <Button
                className={linkedInButton}
                loading={busy === "approve-post"}
                disabled={busy !== null || !text.trim() || tooLong}
                onClick={() => void run("approve-post")}
              >
                {busy === "approve-post" ? "Approving and posting…" : "Approve and post to LinkedIn"}
              </Button>
            ) : null}
            <Button
              variant={connected ? "secondary" : "primary"}
              className="w-full"
              loading={busy === "approve"}
              disabled={busy !== null}
              onClick={() => void run("approve")}
            >
              {connected ? "Approve without posting" : "Approve (post later)"}
            </Button>
            {approval && approval.marks > 0 ? (
              <p className="text-[11.5px] text-stone-500">Approving adds +{approval.marks} bonus marks to the student&apos;s grades.</p>
            ) : null}
          </>
        ) : connected ? (
          <Button
            className={linkedInButton}
            loading={busy === "post"}
            disabled={busy !== null || !text.trim() || tooLong}
            onClick={() => void run("post")}
          >
            {busy === "post" ? "Posting…" : "Post to LinkedIn"}
          </Button>
        ) : null}

        {!connected && isAdmin ? (
          <Button className={linkedInButton} loading={busy === "connect"} disabled={busy !== null} onClick={() => void connect()}>
            <Link2 className="size-4" />
            Connect the portal&apos;s LinkedIn
          </Button>
        ) : null}

        {connected ? (
          <p className="text-[11.5px] leading-snug text-stone-500">
            Goes out publicly straight away. The student is notified.
          </p>
        ) : null}
      </>
    );
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/55 p-2 backdrop-blur-sm sm:p-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="LinkedIn post preview"
        onClick={(e) => e.stopPropagation()}
        className="flex h-full max-h-[94dvh] w-full max-w-5xl flex-col overflow-hidden rounded-[20px] bg-white shadow-[0_40px_100px_-30px_rgba(13,31,63,0.7)]"
      >
        <header className="flex items-center gap-3 border-b border-sand-200/70 px-5 py-3">
          <LinkedInMark className="size-6 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-medium text-ink-900">
              {approving ? "Approve and post to LinkedIn" : "LinkedIn post preview"}
            </p>
            <p className="truncate text-[12px] text-stone-500">{a.title}</p>
          </div>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Close preview"
            className="rounded-lg p-1.5 text-stone-500 hover:bg-ivory-100 hover:text-ink-800"
          >
            <X className="size-5" />
          </button>
        </header>

        <div className="grid min-h-0 flex-1 overflow-auto lg:grid-cols-[minmax(0,1fr)_22rem] lg:overflow-hidden">
          {/* The post as it will appear in the LinkedIn feed. */}
          <div className="bg-[#f4f2ee] px-3 py-6 sm:px-8 lg:overflow-auto">
            <p className="mx-auto mb-2 max-w-[34rem] text-[11.5px] font-medium tracking-wide text-stone-500 uppercase">
              How it will look on LinkedIn
            </p>
            <FeedPost
              authorName={account?.name || FALLBACK_AUTHOR}
              picture={account?.picture}
              text={text}
              imageUrl={imagePath ? imageUrl : null}
              imageAlt={a.title}
            />
          </div>

          {/* Editor and the decision. */}
          <div className="flex flex-col gap-4 border-t border-sand-200/70 p-5 lg:overflow-auto lg:border-t-0 lg:border-l">
            <div>
              <label htmlFor="linkedin-text" className="text-[12.5px] font-medium text-ink-800">
                Post text
              </label>
              <Textarea
                id="linkedin-text"
                rows={10}
                value={text}
                onChange={(e) => setText(e.target.value)}
                disabled={!!posted}
                className="mt-1.5 font-[inherit] text-[13px] leading-relaxed"
              />
              <p className={cn("tnum mt-1 text-right text-[11.5px]", tooLong ? "text-clay-500" : "text-stone-400")}>
                {text.trim().length} / {MAX_LENGTH}
              </p>
            </div>

            <div>
              <p className="text-[12.5px] font-medium text-ink-800">Image</p>
              {images.length === 0 ? (
                <p className="mt-1 flex items-center gap-1.5 text-[12.5px] text-stone-500">
                  <ImageOff className="size-3.5" />
                  No JPG, PNG or GIF among the proof documents - the post goes out as text.
                </p>
              ) : (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {[...images.map((d) => ({ path: d.path, name: d.name })), { path: null, name: "No image" }].map((d) => (
                    <button
                      key={d.path ?? "none"}
                      type="button"
                      disabled={!!posted}
                      onClick={() => setImagePath(d.path)}
                      className={cn(
                        "max-w-full truncate rounded-full px-3 py-1 text-[12px] ring-1 ring-inset",
                        imagePath === d.path
                          ? "bg-[#0a66c2] text-white ring-[#0a66c2]"
                          : "bg-white text-stone-600 ring-sand-200 hover:text-ink-800",
                      )}
                    >
                      {d.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-auto space-y-3 rounded-[14px] bg-ivory-100 p-4">
              {actions}
              {error ? (
                <p role="alert" className="text-[12.5px] text-clay-500">
                  {error}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * PBL office: the portal's central LinkedIn account. Connecting means signing
 * in on LinkedIn's own page with that account, so its password never passes
 * through the portal and teachers never see it.
 */
export function LinkedInAccountCard() {
  const [account, setAccount] = useLinkedInAccount();
  const [busy, setBusy] = useState<"connect" | "disconnect" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function connect() {
    setBusy("connect");
    setError(null);
    try {
      await repo.connectLinkedIn(window.location.pathname);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start the LinkedIn sign-in.");
      setBusy(null);
    }
  }

  async function disconnect() {
    setBusy("disconnect");
    setError(null);
    try {
      await repo.disconnectLinkedIn();
      setAccount(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not disconnect LinkedIn.");
    } finally {
      setBusy(null);
    }
  }

  const expired = account?.expired ?? false;
  const daysLeft = account?.daysLeft ?? 0;

  return (
    <Card>
      <CardHeader
        title="Portal LinkedIn account"
        description="Every approved achievement is posted from this one account. Teachers only preview the post and approve it; they never see its login."
      />
      <div className="flex flex-wrap items-center gap-4 px-5 pb-5">
        {account === undefined ? (
          <p className="flex items-center gap-2 text-[13px] text-stone-500">
            <Loader2 className="size-4 animate-spin" />
            Loading…
          </p>
        ) : account ? (
          <>
            {account.picture ? (
              // eslint-disable-next-line @next/next/no-img-element -- LinkedIn's own image host
              <img src={account.picture} alt="" className="size-12 rounded-full object-cover" />
            ) : (
              <span className="flex size-12 items-center justify-center rounded-full bg-[#dbe7f3] text-[15px] font-semibold text-[#0a66c2]">
                {initials(account.name || "LinkedIn")}
              </span>
            )}
            <div className="min-w-0 flex-1 text-[13px]">
              <p className="font-medium text-ink-900">{account.name || "LinkedIn account"}</p>
              <p className="text-stone-500">
                Connected by {account.connectedBy || "the PBL office"} on {formatDate(account.connectedAt)} ·{" "}
                {expired ? (
                  <span className="font-medium text-clay-500">expired - connect again</span>
                ) : (
                  <span className={cn(daysLeft <= 7 && "font-medium text-gold-600")}>
                    {daysLeft} day{daysLeft === 1 ? "" : "s"} left (LinkedIn connections last 60 days)
                  </span>
                )}
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant={expired ? "primary" : "secondary"} loading={busy === "connect"} disabled={busy !== null} onClick={() => void connect()}>
                <Link2 className="size-3.5" />
                {expired ? "Connect again" : "Reconnect"}
              </Button>
              <Button size="sm" variant="ghost" loading={busy === "disconnect"} disabled={busy !== null} onClick={() => void disconnect()}>
                <Unlink className="size-3.5" />
                Disconnect
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="min-w-0 flex-1 text-[13px] leading-relaxed text-stone-600">
              Not connected. Click <span className="font-medium">Connect LinkedIn</span> and sign in on LinkedIn&apos;s page
              with the portal&apos;s central account. Until then, approved achievements wait to be posted.
            </p>
            <Button
              size="sm"
              className="bg-[#0a66c2] text-white hover:bg-[#004182]"
              loading={busy === "connect"}
              disabled={busy !== null}
              onClick={() => void connect()}
            >
              <Link2 className="size-3.5" />
              Connect LinkedIn
            </Button>
          </>
        )}
        {error ? (
          <p role="alert" className="w-full text-[12.5px] text-clay-500">
            {error}
          </p>
        ) : null}
      </div>
    </Card>
  );
}

/** One post card as LinkedIn draws it in the feed. */
function FeedPost({
  authorName,
  picture,
  text,
  imageUrl,
  imageAlt,
}: {
  authorName: string;
  picture?: string;
  text: string;
  imageUrl: string | null;
  imageAlt: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const body = text.trim();
  const folded = !expanded && body.length > FOLD;
  const shown = folded ? body.slice(0, FOLD).trimEnd() : body;

  return (
    <article className="mx-auto max-w-[34rem] overflow-hidden rounded-lg bg-white font-[system-ui,-apple-system,'Segoe_UI',Roboto,sans-serif] text-[14px] text-black/90 shadow-[0_0_0_1px_rgba(140,140,140,0.2)]">
      <div className="flex items-start gap-2 px-4 pt-3">
        {picture ? (
          // eslint-disable-next-line @next/next/no-img-element -- LinkedIn's own image host
          <img src={picture} alt="" className="size-12 rounded-full object-cover" />
        ) : (
          <span className="flex size-12 items-center justify-center rounded-full bg-[#dbe7f3] text-[15px] font-semibold text-[#0a66c2]">
            {initials(authorName)}
          </span>
        )}
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-[14px] font-semibold">{authorName}</p>
          <p className="truncate text-[12px] text-black/60">Manipal University Jaipur</p>
          <p className="mt-0.5 flex items-center gap-1 text-[12px] text-black/60">
            Now · <Globe className="size-3" aria-label="Public" />
          </p>
        </div>
        <MoreHorizontal className="size-5 text-black/60" aria-hidden />
      </div>

      <p className="px-4 pt-2 pb-2 leading-[1.43] break-words whitespace-pre-wrap">
        <WithHashtags text={shown} />
        {folded ? (
          <>
            …{" "}
            <button onClick={() => setExpanded(true)} className="text-black/60 hover:text-[#0a66c2] hover:underline">
              more
            </button>
          </>
        ) : null}
      </p>

      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- private proof image from a signed link
        <img src={imageUrl} alt={imageAlt} className="max-h-[32rem] w-full bg-[#f3f2ef] object-contain" />
      ) : null}

      <div className="mx-4 flex items-center gap-1 border-b border-black/10 py-2 text-[12px] text-black/60">
        <span className="flex size-4 items-center justify-center rounded-full bg-[#378fe9]">
          <ThumbsUp className="size-2.5 fill-white text-white" />
        </span>
        Be the first to react
      </div>
      <div className="grid grid-cols-4 px-2 py-1 text-[13px] font-semibold text-black/60">
        {[
          { icon: ThumbsUp, label: "Like" },
          { icon: MessageSquare, label: "Comment" },
          { icon: Repeat2, label: "Repost" },
          { icon: Send, label: "Send" },
        ].map(({ icon: Icon, label }) => (
          <span key={label} className="flex items-center justify-center gap-1.5 rounded py-3">
            <Icon className="size-[18px]" aria-hidden />
            <span className="hidden sm:inline">{label}</span>
          </span>
        ))}
      </div>
    </article>
  );
}

function WithHashtags({ text }: { text: string }) {
  return (
    <>
      {text.split(/(#[\p{L}\p{N}]+)/u).map((part, i) =>
        i % 2 ? (
          <span key={i} className="font-semibold text-[#0a66c2]">
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}

function LinkedInMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <rect width="24" height="24" rx="4" fill="#0a66c2" />
      <path
        fill="#fff"
        d="M7.1 9.5H4.9V19h2.2V9.5Zm.2-3a1.3 1.3 0 1 0-2.6 0 1.3 1.3 0 0 0 2.6 0ZM19.3 13.6c0-2.6-1.4-4.3-3.7-4.3-1.2 0-2 .6-2.4 1.3V9.5h-2.1V19h2.2v-5c0-1.3.6-2.1 1.7-2.1 1 0 1.6.7 1.6 2.1v5h2.2v-5.4Z"
      />
    </svg>
  );
}
