import Nav from './sections/Nav';
import Hero from './sections/Hero';
import ProblemSolution from './sections/ProblemSolution';
import Features from './sections/Features';
import DinerExperience from './sections/DinerExperience';
import HowItWorks from './sections/HowItWorks';
import Audience from './sections/Audience';
import Pricing from './sections/Pricing';
import FAQ from './sections/FAQ';
import CTA from './sections/CTA';
import Footer from './sections/Footer';

export default function LandingPage() {
  return (
    <div className="bg-white text-slate-900">
      <Nav />
      <main>
        <Hero />
        <ProblemSolution />
        <Features />
        <DinerExperience />
        <HowItWorks />
        <Audience />
        <Pricing />
        <FAQ />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
