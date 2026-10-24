// Frontend/src/components/classify/FeedbackBox.jsx
import { useState } from 'react';
import { sendFeedback } from '../../lib/api.js';
import Button from '../common/Button.jsx';

export default function FeedbackBox({ predictionId }) {
  const [text, setText] = useState('');
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    const value = text.trim();
    if (!value) {
      setStatus('Please type the actual disease first.');
      return;
    }
    setSaving(true);
    try {
      await sendFeedback(predictionId, value);
      setStatus('Saved ✓');
    } catch (err) {
      console.error(err);
      setStatus("Couldn't save. Is the backend running?");
    }
    setSaving(false);
  }

  return (
    <div className="feedback-box">
      <h4>What disease is it really?</h4>
      <div className="feedback-row">
        <input
          type="text"
          value={text}
          placeholder="e.g. blast, brown spot, healthy"
          autoComplete="off"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
        />
        <Button variant="out" size="sm" disabled={saving} onClick={save}>Save</Button>
      </div>
      <p className="feedback-status">{status}</p>
    </div>
  );
}