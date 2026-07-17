import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

export interface OfferEmailProps {
  recipientName: string;
  offerTitle: string;
  intro?: string;
  offerUrl: string;
  galleryName: string;
  galleryAddress?: string;
  unsubscribeUrl?: string;
  expiresAt?: string;
  /** Simple viewing password, shown to the client when the offer is gated. */
  accessPassword?: string;
}

/**
 * Offer / fair-preview email. Understated greyscale to match the house style;
 * the tokenized link is unique per recipient.
 */
export function OfferEmail({
  recipientName,
  offerTitle,
  intro,
  offerUrl,
  galleryName,
  galleryAddress,
  unsubscribeUrl,
  expiresAt,
  accessPassword,
}: OfferEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{offerTitle}</Preview>
      <Body style={{ backgroundColor: "#fafafa", fontFamily: "Helvetica, Arial, sans-serif", margin: 0 }}>
        <Container style={{ maxWidth: 560, margin: "0 auto", padding: "32px 20px" }}>
          <Text style={{ fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8a8a8a" }}>
            {galleryName}
          </Text>
          <Heading as="h1" style={{ fontSize: 24, lineHeight: 1.2, color: "#2a2a2a", marginTop: 8 }}>
            {offerTitle}
          </Heading>
          <Text style={{ fontSize: 15, lineHeight: 1.6, color: "#3d3d3d" }}>
            Dear {recipientName},
          </Text>
          {intro ? (
            <Text style={{ fontSize: 15, lineHeight: 1.6, color: "#3d3d3d" }}>{intro}</Text>
          ) : null}
          <Section style={{ margin: "28px 0" }}>
            <Button
              href={offerUrl}
              style={{
                backgroundColor: "#2a2a2a",
                color: "#f7f7f7",
                fontSize: 14,
                fontWeight: 600,
                padding: "12px 22px",
                borderRadius: 8,
              }}
            >
              View the selection
            </Button>
          </Section>
          {accessPassword ? (
            <Section
              style={{
                margin: "0 0 24px",
                padding: "14px 18px",
                backgroundColor: "#f0f0f0",
                borderRadius: 8,
              }}
            >
              <Text style={{ fontSize: 13, color: "#3d3d3d", margin: 0 }}>
                You’ll be asked for a password to open the page:
              </Text>
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                  color: "#2a2a2a",
                  margin: "6px 0 0",
                }}
              >
                {accessPassword}
              </Text>
              <Text style={{ fontSize: 12, color: "#6f6f6f", margin: "6px 0 0" }}>
                Prefer not to type it? On the page you can ask us to email you a temporary
                sign-in link instead.
              </Text>
            </Section>
          ) : null}
          <Text style={{ fontSize: 13, color: "#6f6f6f" }}>
            This private page was prepared for you personally
            {expiresAt ? ` and is available until ${expiresAt}` : ""}. Please do not forward the
            link.
          </Text>
          <Hr style={{ borderColor: "#e2e2e2", margin: "28px 0" }} />
          <Text style={{ fontSize: 12, color: "#8a8a8a", lineHeight: 1.6 }}>
            {galleryName}
            {galleryAddress ? ` · ${galleryAddress}` : ""}
            {unsubscribeUrl ? (
              <>
                {" · "}
                <Link href={unsubscribeUrl} style={{ color: "#8a8a8a", textDecoration: "underline" }}>
                  Unsubscribe
                </Link>
              </>
            ) : null}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
