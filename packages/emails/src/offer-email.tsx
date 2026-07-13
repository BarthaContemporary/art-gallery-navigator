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
