"use client";

import { useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Mail, MapPin, Phone, Send } from "lucide-react";

const FAQS = [
  {
    q: "Does CafeFlow POS need an internet connection to work?",
    a: "No. The desktop POS is offline-first and stores everything in a local SQLite database on your terminal. Ordering, billing, printing and daily closing all work with zero connectivity. When internet returns, pending sales and orders sync automatically to the cloud.",
  },
  {
    q: "What happens if the same sale is uploaded twice?",
    a: "Nothing bad — the sync API is idempotent. Every record carries a unique local ID, and the server enforces uniqueness per (restaurant, local ID). Duplicated uploads are detected and skipped, so network retries never create double entries.",
  },
  {
    q: "Can one account manage several restaurants?",
    a: "Yes. A client account can own any number of restaurants — 1, 3, 10 or 50. Each restaurant is a fully isolated workspace with its own license, devices, sales, orders and reports. You see all of them from one login, and data is never mixed.",
  },
  {
    q: "How are licenses and devices handled?",
    a: "Each restaurant holds one license with a device limit (e.g. 1–20 POS terminals). A device activates using the license key and receives a secure device token. If Windows is reinstalled or hardware changes, an administrator can reset the device slot — customers are never permanently locked out.",
  },
  {
    q: "What happens to the POS if the license expires while offline?",
    a: "The POS caches license state locally and continues operating through a configurable grace period (default 14 days) without connectivity. The web server remains the source of truth — once online, verification updates the cached state, and expiring licenses surface warnings in the client dashboard.",
  },
  {
    q: "Can I access sales data from my phone or tablet?",
    a: "Yes. The web dashboard is fully responsive — monitor today's sales, order counts, license status and device health from any modern browser on desktop, tablet or mobile.",
  },
  {
    q: "How is my business data kept private?",
    a: "Data isolation is enforced at the database layer with row-level security policies, not just in the UI. A client can only ever query restaurants, licenses, devices and sales that belong to their own account — even crafted API requests cannot cross that boundary.",
  },
];

export function FaqSection() {
  return (
    <section id="faq" className="py-16 sm:py-20 border-y bg-muted/30">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Frequently asked questions
          </h2>
          <p className="mt-4 text-base text-muted-foreground">
            Everything owners usually ask before switching their tills to
            CafeFlow.
          </p>
        </div>
        <Accordion type="single" collapsible className="mt-10">
          {FAQS.map((f, i) => (
            <AccordionItem key={f.q} value={`item-${i}`}>
              <AccordionTrigger className="text-left text-[15px]">
                {f.q}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-relaxed text-sm">
                {f.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}

export function ContactSection() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message }),
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        toast.error(result.error?.message ?? "Message could not be sent.");
        return;
      }

      toast.success("Message sent successfully.");
      setName("");
      setEmail("");
      setMessage("");
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <section id="contact" className="py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-10 items-start">
          <div>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Talk to the CafeFlow team
            </h2>
            <p className="mt-4 text-base text-muted-foreground leading-relaxed">
              Licensing questions, multi-location rollouts or a demo for your
              cafe — we reply within one business day.
            </p>
            <div className="mt-8 space-y-4">
              {[
                {
                  icon: Mail,
                  label: "Email",
                  value: "cafeflow72@gmail.com",
                },
                {
                  icon: Phone,
                  label: "Phone",
                  value: "+92 309 6345662 (Mon–Sat, 10:00–19:00 PKT)",
                },
                {
                  icon: MapPin,
                  label: "Office",
                  value: "Gulberg III, Lahore, Pakistan",
                },
              ].map((c) => (
                <div key={c.label} className="flex items-center gap-3.5">
                  <div className="rounded-lg bg-primary/10 text-primary p-2.5">
                    <c.icon className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{c.label}</p>
                    <p className="text-sm font-medium">{c.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Card className="border-border/60">
            <CardContent className="p-6">
              <form onSubmit={submit} className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="c-name">Your name</Label>
                    <Input
                      id="c-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ahmed Raza"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="c-email">Email</Label>
                    <Input
                      id="c-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@business.com"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="c-message">How can we help?</Label>
                  <Textarea
                    id="c-message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="We run 3 cafes in Lahore and want to know about licensing…"
                    rows={5}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={sending}>
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  {sending ? "Sending..." : "Send message"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
