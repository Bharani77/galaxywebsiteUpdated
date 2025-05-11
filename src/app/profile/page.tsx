"use client";

import { useSearchParams, useRouter } from "next/navigation"; // useRouter might not be needed if redirects are fully middleware handled
import React, { Suspense, useEffect, useCallback } from "react";
import { ToastContainer, toast } from 'react-toastify'; // toast might still be used for other notifications
import 'react-toastify/dist/ReactToastify.css';
import GalaxyForm from './GalaxyForm';

// Supabase client and direct session validation logic removed.
// Middleware will handle session validation before this page is rendered.

function ProfileContent() {
    const searchParams = useSearchParams();
    // const router = useRouter(); // May not be needed if middleware handles all redirects
    const urlUsername = searchParams.get("username"); // Still might be used for display or initial context

    // The handleLogoutAndRedirect and handleUserRemoval functions might still be relevant
    // if GalaxyForm or other components trigger a logout or user removal action.
    // However, the periodic validation is gone.

    // If the page loads, middleware has validated the session.
    // We might still want to get the username from cookies for display,
    // but this page component itself doesn't need to re-validate.

    // Example: If you need to display the username from the cookie (though it's httpOnly, so not directly accessible here)
    // One option is for the middleware to add it to request headers, and a Server Component parent could pass it down.
    // Or, the sign-in API could return it (as it does) and it could be stored in a React context or Zustand/Redux store
    // if needed by multiple components, but not in sessionStorage for security tokens.

    // For now, we assume GalaxyForm handles its needs, or username is passed if necessary.
    // The primary change is removing the useEffect for polling validation.

    useEffect(() => {
        // Basic check for URL username, though middleware should protect the route.
        if (!urlUsername) {
            // This case should ideally be caught by middleware redirecting if session is invalid
            // or if the route is accessed directly without proper context.
            // If middleware is correctly configured, this page shouldn't load without a valid session.
            // toast.error('Invalid profile URL.'); // Consider if this is still needed
            // router.push('/signin'); // Middleware should handle this
            console.log("Profile page loaded, expecting middleware to have validated session.");
        }
        // No more polling validateClientSession
    }, [urlUsername]);

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 relative">
            {/* Logout button removed, handled by GalaxyForm component */}
            <ToastContainer
                position="top-right"
                autoClose={3000}
                hideProgressBar={false}
                newestOnTop={false}
                closeOnClick
                rtl={false}
                pauseOnFocusLoss
                draggable
                pauseOnHover
                theme="light"
            />
            <GalaxyForm />
        </div>
    );
}

export default function ProfilePage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center"> {/* Removed background gradient for fallback */}
                <div className="text-white text-xl">Loading...</div>
            </div>
        }>
            <ProfileContent />
        </Suspense>
    );
}
