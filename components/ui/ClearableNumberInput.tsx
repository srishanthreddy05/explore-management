import React, { useState, useEffect } from "react";

interface ClearableNumberInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> {
  value: number | "";
  onChange: (val: number | "") => void;
}

export function ClearableNumberInput({
  value,
  onChange,
  className = "",
  placeholder = "0",
  ...props
}: ClearableNumberInputProps) {
  const [localVal, setLocalVal] = useState<string>(() => (value === "" ? "" : String(value)));

  useEffect(() => {
    setLocalVal((prev) => {
      // If the incoming value parsed is the same as our local representation,
      // preserve the user's active cursor/formatting (e.g. typing a trailing decimal points like '10.')
      const parsedPrev = prev === "" ? "" : parseFloat(prev);
      if (parsedPrev === value) {
        return prev;
      }
      return value === "" ? "" : String(value);
    });
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    setLocalVal(rawValue);

    if (rawValue === "") {
      onChange("");
    } else {
      const parsed = parseFloat(rawValue);
      onChange(isNaN(parsed) ? "" : parsed);
    }
  };

  const handleBlur = () => {
    // Sync back on blur to ensure well-formed values
    setLocalVal(value === "" ? "" : String(value));
  };

  return (
    <input
      type="number"
      value={localVal}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder}
      className={`border-none bg-transparent outline-none shadow-none focus:outline-none focus:ring-0 w-full ${className}`}
      {...props}
    />
  );
}
