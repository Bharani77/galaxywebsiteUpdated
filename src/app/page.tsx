'use client';

import Link from 'next/link';

export default function Home() {
  return (
    <div className="welcome-container">
      <h1 className="welcome-title">
        KICK ~ LOCK
      </h1>
      <p className="text-gray-400 mb-8 text-lg">
        Welcome to the ultimate gaming companion
      </p>
      <div className="welcome-buttons">
        <Link href="/signin">
          <button className="welcome-button">
            Sign In
          </button>
        </Link>
        <Link href="/signup">
          <button className="welcome-button">
            Sign Up
          </button>
        </Link>
      </div>
    </div>
  );
}
