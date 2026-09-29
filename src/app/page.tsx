import { LandingNavbar } from "@/components/landing/navbar";
import { Hero } from "@/components/landing/hero";
import {
  FeaturesSection,
  OfflineSection,
  MultiRestaurantSection,
  LicensingSection,
  SecuritySection,
} from "@/components/landing/sections";
import { FaqSection, ContactSection } from "@/components/landing/faq-contact";
import { LandingFooter } from "@/components/landing/footer";

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <LandingNavbar />
      <main className="flex-1">
        <Hero />
        <FeaturesSection />
        <OfflineSection />
        <MultiRestaurantSection />
        <LicensingSection />
        <SecuritySection />
        <FaqSection />
        <ContactSection />
      </main>
      <LandingFooter />
    </div>
  );
}
