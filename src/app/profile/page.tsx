"use client";

import { useSearchParams } from "next/navigation";
import React, { Suspense, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl!, supabaseAnonKey!);

function ProfileContent() {
    const searchParams = useSearchParams();
    const username = searchParams.get("username");

    const validateSession = async () => {
        const userId = sessionStorage.getItem("userId");
        const sessionId = sessionStorage.getItem("sessionId");

        if (!userId || !sessionId) {
            // No session data found, redirect to sign-in
            sessionStorage.clear();
            window.location.href = "/signin";
            return;
        }

        // Query the database to check if the session is still valid
        const { data: user, error } = await supabase
            .from("users")
            .select("active_session_id")
            .eq("id", userId)
            .single();

        if (error || !user || user.active_session_id !== sessionId) {
            // Session is no longer valid, terminate it
            sessionStorage.clear();
            window.location.href = "/";
        }
    };

    useEffect(() => {
        // Validate session every 10 seconds
        const interval = setInterval(validateSession, 10000);

        // Listen for real-time updates to the user's session
        const userId = sessionStorage.getItem("userId");
        if (userId) {
            const channel = supabase
                .channel("session-updates")
                .on(
                    "broadcast",
                    { event: "session_terminated" },
                    (payload) => {
                        if (payload.userId === parseInt(userId)) {
                            sessionStorage.clear();
                            window.location.href = "/";
                        }
                    }
                )
                .subscribe();

            return () => {
                clearInterval(interval);
                channel.unsubscribe();
            };
        } else {
            clearInterval(interval);
        }
    }, []);

    return (
        <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center">
            <div className="text-4xl font-bold mb-4">
                Hello,{" "}
                <span className="text-purple-500">
                    {username ? username : "Guest"}
                </span>
                !
            </div>
            {/* Add other content or components here */}
        </div>
    );
}

export default function ProfilePage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <ProfileContent />
        </Suspense>
    );
}