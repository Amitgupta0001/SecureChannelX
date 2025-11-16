import React, { useState } from "react";
import "../../styles/components/PollCreator.css";


const PollCreator = ({ onCreate, onClose }) => {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);

  const updateOption = (i, value) => {
    const updated = [...options];
    updated[i] = value;
    setOptions(updated);
  };

  const addOption = () => {
    setOptions([...options, ""]);
  };

  const createPoll = () => {
    if (!question.trim() || options.some((opt) => !opt.trim())) return;

    onCreate({
      question,
      options,
      createdAt: new Date().toISOString(),
    });

    setQuestion("");
    setOptions(["", ""]);
    onClose();
  };

  return (
    <div className="poll-overlay">
      <div className="poll-modal">

        <div className="poll-header">
          <h3>Create Poll</h3>
          <button onClick={onClose} className="close-button">×</button>
        </div>

        <div className="poll-content">

          <input
            type="text"
            placeholder="Poll question..."
            className="poll-input"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />

          {options.map((opt, i) => (
            <input
              key={i}
              type="text"
              placeholder={`Option ${i + 1}`}
              className="poll-input"
              value={opt}
              onChange={(e) => updateOption(i, e.target.value)}
            />
          ))}

          <button className="poll-add-btn" onClick={addOption}>
            + Add Option
          </button>

          <button className="poll-create-btn" onClick={createPoll}>
            Create Poll
          </button>

        </div>

      </div>
    </div>
  );
};

export default PollCreator;
