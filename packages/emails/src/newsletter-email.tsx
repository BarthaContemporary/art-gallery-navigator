import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

export interface NewsletterWork {
  title: string;
  maker?: string;
  imageUrl?: string;
  url: string;
}

export interface NewsletterEmailProps {
  salutation: string;
  subject: string;
  bodyHtmlParagraphs: string[];
  works?: NewsletterWork[];
  galleryName: string;
  galleryAddress?: string;
  unsubscribeUrl: string;
}

/** Personalised newsletter — one greeting per recipient, sent via Resend batch. */
export function NewsletterEmail({
  salutation,
  subject,
  bodyHtmlParagraphs,
  works,
  galleryName,
  galleryAddress,
  unsubscribeUrl,
}: NewsletterEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{subject}</Preview>
      <Body style={{ backgroundColor: "#fafafa", fontFamily: "Helvetica, Arial, sans-serif", margin: 0 }}>
        <Container style={{ maxWidth: 560, margin: "0 auto", padding: "32px 20px" }}>
          <Text style={{ fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8a8a8a" }}>
            {galleryName}
          </Text>
          <Heading as="h1" style={{ fontSize: 22, lineHeight: 1.25, color: "#2a2a2a", marginTop: 8 }}>
            {subject}
          </Heading>
          <Text style={{ fontSize: 15, lineHeight: 1.6, color: "#3d3d3d" }}>{salutation},</Text>
          {bodyHtmlParagraphs.map((p, i) => (
            <Text key={i} style={{ fontSize: 15, lineHeight: 1.6, color: "#3d3d3d" }}>
              {p}
            </Text>
          ))}
          {works && works.length > 0 ? (
            <Section style={{ marginTop: 24 }}>
              {works.map((w, i) => (
                <Section key={i} style={{ marginBottom: 20 }}>
                  {w.imageUrl ? (
                    <Img
                      src={w.imageUrl}
                      alt={w.title}
                      width={520}
                      style={{ borderRadius: 8, width: "100%" }}
                    />
                  ) : null}
                  <Text style={{ fontSize: 14, color: "#2a2a2a", marginBottom: 0 }}>
                    <Link href={w.url} style={{ color: "#2a2a2a" }}>
                      {w.title}
                    </Link>
                  </Text>
                  {w.maker ? (
                    <Text style={{ fontSize: 13, color: "#6f6f6f", marginTop: 2 }}>{w.maker}</Text>
                  ) : null}
                </Section>
              ))}
            </Section>
          ) : null}
          <Hr style={{ borderColor: "#e2e2e2", margin: "28px 0" }} />
          <Text style={{ fontSize: 12, color: "#8a8a8a", lineHeight: 1.6 }}>
            {galleryName}
            {galleryAddress ? ` · ${galleryAddress}` : ""} ·{" "}
            <Link href={unsubscribeUrl} style={{ color: "#8a8a8a", textDecoration: "underline" }}>
              Unsubscribe
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
