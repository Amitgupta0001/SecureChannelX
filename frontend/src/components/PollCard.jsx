import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import advancedChatApi from "../api/advancedchatApi";
import { useSocket } from "../context/SocketContext";

/**
 * PollCard
 *
 * Props:
 * - poll: {
 *     poll_id, question, options: [string], created_by, is_anonymous, allows_multiple, votes: { userId: optionIndex | [optionIndexes] }
 *   }
 * - token: JWT token (string)
 * - onClose: optional callback when closing/hiding poll
 *
 * Behavior:
 * - Renders poll with options and vote buttons.
 * - If user has already voted (single-choice), shows results and prevents re-vote.
 * - For multiple choice polls, allows toggling multiple options then Submit.
 * - Submits votes via advancedChatApi.votePoll(pollId, optionIndex, token).
 * - Listens to socket events 'poll_updated' and 'new_poll' to live-update results.
 *
 * Notes:
 * - UI uses Tailwind classes (already used in the project).
 * - Animations by Framer Motion.
 */

export default function PollCard({ poll, token, onClose, currentUserId }) {
  const { socket } = useSocket();
  const [localPoll, setLocalPoll] = useState(poll);
  const [selected, setSelected] = useState(
    poll.allows_multiple ? [] : null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // derive results from votes map (poll.votes is an object userId -> vote)
  const results = useMemo(() => {
    const counts = (localPoll.options || []).map(() => 0);
    const votesObj = localPoll.votes || {};
    Object.values(votesObj).forEach((v) => {
      if (Array.isArray(v)) {
        v.forEach((idx) => {
          if (typeof idx === "number" && counts[idx] !== undefined) counts[idx] += 1;
        });
      } else if (typeof v === "number" && counts[v] !== undefined) {
        counts[v] += 1;
      }
    });
    const total = counts.reduce((a, b) => a + b, 0);
    return { counts, total };
  }, [localPoll]);

  // check if current user already voted (for single choice)
  const userVote = useMemo(() => {
    const votes = localPoll.votes || {};
    const v = votes[currentUserId];
    return v === undefined ? null : v;
  }, [localPoll, currentUserId]);

  useEffect(() => {
    setLocalPoll(poll);
    // if already voted and single-choice, reflect selection
    if (!poll.allows_multiple && poll.votes && poll.votes[currentUserId] !== undefined) {
      setSelected(poll.votes[currentUserId]);
    }
    // if multiple and voted, reflect selected array
    if (poll.allows_multiple && poll.votes && Array.isArray(poll.votes[currentUserId])) {
      setSelected(poll.votes[currentUserId]);
    }
  }, [poll, currentUserId]);

  // socket live updates
  useEffect(() => {
    if (!socket) return;

    const onPollUpdated = (payload) => {
      if (!payload || payload.poll_id !== localPoll.poll_id) return;
      // payload.results might be computed server-side; prefer full poll fetch if available
      // We'll optimistically update local votes structure if present
      if (payload.results && payload.results.votes) {
        // payload.results.votes is index->count map; we need the votes map to show user-specific votes.
        // Best we can do is update counts (non-user specific) — backend doesn't send full user->vote for privacy.
        // We'll merge counts into localPoll for visual results only.
        setLocalPoll((prev) => ({ ...prev, _server_counts: payload.results.votes, total_votes: payload.results.total_votes }));
      } else if (payload.poll) {
        setLocalPoll(payload.poll);
      }
    };

    const onNewPoll = (payload) => {
      if (!payload || payload.poll_id !== localPoll.poll_id) return;
      // If a new poll is broadcasted, replace localPoll
      setLocalPoll(payload.poll || payload);
    };

    socket.on("poll_updated", onPollUpdated);
    socket.on("new_poll", onNewPoll);

    return () => {
      socket.off("poll_updated", onPollUpdated);
      socket.off("new_poll", onNewPoll);
    };
  }, [localPoll.poll_id, socket]);

  const toggleOption = (idx) => {
    setError(null);
    if (localPoll.allows_multiple) {
      setSelected((prev) => {
        if (!Array.isArray(prev)) return [idx];
        if (prev.includes(idx)) return prev.filter((i) => i !== idx);
        return [...prev, idx];
      });
    } else {
      setSelected(idx);
    }
  };

  const submitVote = async () => {
    setError(null);
    if (selected === null || (Array.isArray(selected) && selected.length === 0)) {
      setError("Please choose an option to vote.");
      return;
    }

    // For single-choice, backend expects option_index; for multiple, backend handles adds or sets via option_index or addToSet
    // advancedChatApi.votePoll expects (pollId, optionIndex)
    setLoading(true);
    try {
      if (localPoll.allows_multiple) {
        // For multiple choice, send votes sequentially (backend's mock supports addToSet)
        // If already voted some options, we avoid re-sending duplicates.
        const selectedArr = Array.isArray(selected) ? selected : [selected];
        // submit each option using votePoll (server `vote_on_poll` handles multi-choice by adding to set)
        for (const idx of selectedArr) {
          // eslint-disable-next-line no-await-in-loop
          await advancedChatApi.votePoll(localPoll.poll_id, idx, token);
        }
        // After voting, fetch updated poll via server push or optimistic update
        // We'll optimistically update local votes: mark user voted for these options
        setLocalPoll((prev) => {
          const votes = { ...(prev.votes || {}) };
          votes[currentUserId] = selectedArr;
          return { ...prev, votes };
        });
      } else {
        const res = await advancedChatApi.votePoll(localPoll.poll_id, selected, token);
        // if server returned updated results, merge them (res.results expected)
        if (res && res.results) {
          // Server returns results map; we attach for UI display
          setLocalPoll((prev) => ({ ...prev, _server_counts: res.results, total_votes: res.total_votes || prev.total_votes }));
        }
        // Update user's vote locally
        setLocalPoll((prev) => {
          const votes = { ...(prev.votes || {}) };
          votes[currentUserId] = selected;
          return { ...prev, votes };
        });
      }
      setLoading(false);
    } catch (err) {
      setLoading(false);
      setError(err?.response?.data?.error || err.message || "Vote failed");
    }
  };

  const renderBar = (count, total) => {
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    return (
      <div className="w-full bg-[#0b1220] rounded-full h-2 overflow-hidden">
        <div
          className="h-2 rounded-full transition-all"
          style={{
            width: `${pct}%`,
            background: "linear-gradient(90deg,#1f6feb,#3b82f6)",
          }}
        />
      </div>
    );
  };

  return (
    <motion.div
      initial={{ scale: 0.995, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.18 }}
      className="bg-[#0b1220] border border-[#1f2937] rounded-xl p-4 max-w-xl w-full shadow-md"
    >
      <div className="flex justify-between items-start gap-3">
        <div className="flex-1">
          <h4 className="text-white text-lg font-semibold">{localPoll.question}</h4>
          <div className="text-xs text-gray-400 mt-1">
            {localPoll.is_anonymous ? "Anonymous poll" : `Created by ${localPoll.created_by || "someone"}`}
            {localPoll.allows_multiple && <span className="ml-2 text-green-400"> • Multiple choice</span>}
          </div>
        </div>

        <div>
          {onClose && (
            <button onClick={() => onClose()} className="text-sm text-gray-400 hover:text-white">
              ✕
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {(localPoll.options || []).map((opt, idx) => {
          const count = results.counts[idx] || 0;
          const total = results.total || localPoll.total_votes || 0;
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          const voted = Array.isArray(userVote) ? userVote.includes(idx) : userVote === idx;
          const selectedNow = Array.isArray(selected) ? selected.includes(idx) : selected === idx;

          return (
            <div key={idx} className="space-y-2">
              <button
                onClick={() => toggleOption(idx)}
                disabled={!localPoll.allows_multiple && userVote !== null} // for single-choice, lock after vote
                className={`w-full flex items-center justify-between gap-3 p-3 rounded-lg transition
                  ${selectedNow || voted ? "bg-[#111827] border border-[#1f2937]" : "bg-[#080a0f] hover:bg-[#0f1724]"}
                `}
                aria-pressed={selectedNow || voted}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold
                      ${selectedNow || voted ? "bg-gradient-to-br from-[#1f6feb] to-[#3b82f6] text-white" : "bg-[#0b1220] text-gray-300 border border-[#1f2937]"}`}>
                    {selectedNow || voted ? "✓" : idx + 1}
                  </div>

                  <div className="text-left">
                    <div className="text-sm text-gray-100">{opt}</div>
                    <div className="text-[11px] text-gray-400">{count} votes • {pct}%</div>
                  </div>
                </div>

                {/* result bar (small) */}
                <div className="w-36 ml-2">{renderBar(count, total)}</div>
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center gap-3">
        {!localPoll.allows_multiple && userVote !== null ? (
          <div className="text-sm text-green-400">You voted ✅</div>
        ) : (
          <button
            onClick={submitVote}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-gradient-to-br from-[#1f6feb] to-[#3b82f6] hover:from-[#2563eb] text-white font-semibold shadow-sm"
          >
            {loading ? "Voting..." : localPoll.allows_multiple ? "Submit votes" : "Vote"}
          </button>
        )}

        <div className="text-sm text-gray-400 ml-auto">{results.total} votes</div>
      </div>

      {error && <div className="mt-2 text-sm text-rose-400">{error}</div>}
    </motion.div>
  );
}
