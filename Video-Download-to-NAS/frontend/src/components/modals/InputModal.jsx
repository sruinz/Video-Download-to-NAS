import React, { useState, useEffect } from 'react';
import ModalWrapper from './ModalWrapper';

export default function InputModal({
  isOpen,
  title,
  label,
  defaultValue,
  placeholder,
  type = 'text',
  validation,
  min,
  max,
  unit,
  onConfirm,
  onCancel
}) {
  const [value, setValue] = useState(defaultValue?.toString() || '');
  const [error, setError] = useState(null);
  const [touched, setTouched] = useState(false);

  // Reset when modal opens
  useEffect(() => {
    if (isOpen) {
      setValue(defaultValue?.toString() || '');
      setError(null);
      setTouched(false);
    }
  }, [isOpen, defaultValue]);

  // Validate on value change
  useEffect(() => {
    if (!touched) return;

    if (validation) {
      const errorMsg = validation(value);
      setError(errorMsg);
    } else if (type === 'number') {
      const num = parseFloat(value);
      if (isNaN(num)) {
        setError('Must be a valid number');
      } else if (min !== undefined && num < min) {
        setError(`Must be at least ${min}`);
      } else if (max !== undefined && num > max) {
        setError(`Must be at most ${max}`);
      } else {
        setError(null);
      }
    } else {
      setError(null);
    }
  }, [value, touched, validation, type, min, max]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setTouched(true);

    // Run validation one more time
    let finalError = null;
    if (validation) {
      finalError = validation(value);
    } else if (type === 'number') {
      const num = parseFloat(value);
      if (isNaN(num)) {
        finalError = 'Must be a valid number';
      } else if (min !== undefined && num < min) {
        finalError = `Must be at least ${min}`;
      } else if (max !== undefined && num > max) {
        finalError = `Must be at most ${max}`;
      }
    }

    if (finalError) {
      setError(finalError);
      return;
    }

    onConfirm(value);
  };

  const isValid = !error && value.trim() !== '';

  return (
    <ModalWrapper
      isOpen={isOpen}
      onClose={onCancel}
      title={title}
      size="sm"
    >
      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          {/* Label */}
          <label className="block text-sm font-medium text-gray-300">
            {label}
          </label>

          {/* Input with unit */}
          <div className="relative">
            <input
              type={type}
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setTouched(true);
              }}
              onBlur={() => setTouched(true)}
              placeholder={placeholder}
              className={`w-full px-4 py-2 bg-yt-dark border rounded-lg text-white focus:outline-none focus:ring-2 transition-colors ${
                error && touched
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-gray-700 focus:ring-yt-red'
              } ${unit ? 'pr-16' : ''}`}
              autoFocus
            />
            {unit && (
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                {unit}
              </span>
            )}
          </div>

          {/* Error message */}
          {error && touched && (
            <p className="text-sm text-red-500 flex items-center gap-2">
              <span>⚠️</span>
              {error}
            </p>
          )}

          {/* Validation hint */}
          {!error && (min !== undefined || max !== undefined) && (
            <p className="text-xs text-gray-500">
              {min !== undefined && max !== undefined
                ? `Value must be between ${min} and ${max}`
                : min !== undefined
                ? `Minimum value: ${min}`
                : `Maximum value: ${max}`}
            </p>
          )}

          {/* Buttons */}
          <div className="flex gap-3 justify-end pt-4">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isValid}
              className="px-4 py-2 bg-yt-red hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Confirm
            </button>
          </div>
        </div>
      </form>
    </ModalWrapper>
  );
}
