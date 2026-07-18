import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const features = [
  {
    icon: '📄',
    title: 'Upload PDFs',
    desc: 'Securely store your documents in the cloud and index them for instant AI retrieval.',
  },
  {
    icon: '💬',
    title: 'Ask Anything',
    desc: 'Chat naturally with one PDF or your entire library. Get answers grounded in your documents.',
  },
  {
    icon: '🎯',
    title: 'Cited Sources',
    desc: 'Every answer references the exact file and page number it came from. No hallucinations.',
  },
  {
    icon: '⚡',
    title: 'Blazing Fast',
    desc: 'Powered by Groq inference and Qdrant vector search for sub-second retrieval.',
  },
];

export default function Landing() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-base-100">
      {/* Nav */}
      <div className="navbar max-w-6xl mx-auto px-4">
        <div className="flex-1">
          <span className="text-xl font-bold"><span className="text-primary">📄 DocuChat</span> AI</span>
        </div>
        <div className="flex-none gap-2">
          {user ? (
            <Link to="/dashboard" className="btn btn-primary btn-sm">Dashboard</Link>
          ) : (
            <>
              <Link to="/login" className="btn btn-ghost btn-sm">Login</Link>
              <Link to="/register" className="btn btn-primary btn-sm">Get Started</Link>
            </>
          )}
        </div>
      </div>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 py-24 text-center">
        <div className="badge badge-primary badge-outline mb-6">RAG-powered · LangChain · Groq</div>
        <h1 className="text-4xl md:text-6xl font-extrabold leading-tight">
          Chat with your <span className="text-primary">PDF documents</span>
          <br />like never before
        </h1>
        <p className="mt-6 text-lg opacity-70 max-w-2xl mx-auto">
          Upload any PDF and ask questions in plain English. DocuChat retrieves the exact
          passages that matter and answers with citations — never inventing facts.
        </p>
        <div className="mt-10 flex justify-center gap-4">
          <Link to={user ? '/dashboard' : '/register'} className="btn btn-primary btn-lg">
            Start for free
          </Link>
          <a href="#features" className="btn btn-outline btn-lg">Learn more</a>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-6xl mx-auto px-4 pb-24">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((f) => (
            <div key={f.title} className="card bg-base-200 border border-base-300 hover:border-primary/50 transition-colors">
              <div className="card-body">
                <div className="text-4xl">{f.icon}</div>
                <h3 className="card-title text-lg">{f.title}</h3>
                <p className="text-sm opacity-70">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-base-200 py-20">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-12">How it works</h2>
          <ul className="steps steps-vertical md:steps-horizontal w-full">
            <li className="step step-primary">Upload a PDF</li>
            <li className="step step-primary">We index every page</li>
            <li className="step step-primary">Ask questions</li>
            <li className="step step-primary">Get cited answers</li>
          </ul>
        </div>
      </section>

      <footer className="footer footer-center p-8 text-sm opacity-60">
        <p>DocuChat AI — React · Node.js · MongoDB · Qdrant · LangChain · Groq · AWS S3</p>
      </footer>
    </div>
  );
}
