import React, { createContext, useContext, useEffect, useState } from "react";
import { useSocket } from "./SocketContext";
import { useAuth } from "./AuthContext";
import axios from "axios";

const NotificationContext = createContext();

export const useNotification = () => useContext(NotificationContext);

export const NotificationProvider = ({ children }) => {
    const { socket } = useSocket();
    const { user, token } = useAuth();
    const [permission, setPermission] = useState(Notification.permission);

    // 1. Register Service Worker
    useEffect(() => {
        if ("serviceWorker" in navigator) {
            navigator.serviceWorker
                .register("/service-worker.js")
                .then((reg) => console.log("SW registered:", reg))
                .catch((err) => console.error("SW registration failed:", err));
        }
    }, []);

    // 2. Request Permission & Subscribe (Placeholder for VAPID)
    const requestPermission = async () => {
        const perm = await Notification.requestPermission();
        setPermission(perm);
        if (perm === "granted") {
            console.log("Notification permission granted");
            // TODO: Implement VAPID subscription here when backend supports WebPush
            // const sub = await reg.pushManager.subscribe(...)
            // await axios.post(...)
        }
    };

    // 3. Listen for Socket Notifications (Foreground)
    useEffect(() => {
        if (!socket) return;

        socket.on("notification", (data) => {
            console.log("🔔 Socket Notification:", data);

            // Show system notification if allowed and app is in background (or just always)
            if (document.hidden && permission === "granted") {
                new Notification(data.title, {
                    body: data.body,
                    icon: "/icons/icon-192.png"
                });
            } else {
                // Optional: Show in-app toast
                // toast.info(`${data.title}: ${data.body}`);
            }
        });

        return () => socket.off("notification");
    }, [socket, permission]);

    return (
        <NotificationContext.Provider value={{ requestPermission, permission }}>
            {children}
        </NotificationContext.Provider>
    );
};
