import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Concept from "@/components/Concept";
import Menu from "@/components/Menu";
import Info from "@/components/Info";
import ReservationCTA from "@/components/ReservationCTA";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <Concept />
        <Menu />
        <Info />
        <ReservationCTA />
      </main>
      <Footer />
    </>
  );
}
