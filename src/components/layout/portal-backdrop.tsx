/**
 * Fixed watercolour ground behind every portal page.
 *
 * Same sky-to-snow wash as the landing and sign-in screens, so stepping from
 * the login card into the dashboard feels like staying in the same painting.
 * Nothing pictorial sits behind the content, so cards stay crisp.
 */
export function PortalBackdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,#d9ecf8_0%,#e6f1fa_28%,#eff5fb_62%,#f8fbfe_100%)]" />
      <div className="absolute inset-0 opacity-60 [background-image:radial-gradient(circle_at_30%_6%,rgba(255,255,255,0.95),transparent_42%),radial-gradient(circle_at_85%_18%,rgba(255,255,255,0.7),transparent_38%)]" />
    </div>
  );
}
