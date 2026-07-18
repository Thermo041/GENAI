import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-base-200 px-4 text-center">
      <h1 className="text-8xl font-extrabold text-primary">404</h1>
      <p className="text-xl mt-4 opacity-70">This page got lost in the vector space.</p>
      <Link to="/" className="btn btn-primary mt-8">Back home</Link>
    </div>
  );
}
