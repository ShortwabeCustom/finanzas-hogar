"use client";

interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
  steps: string[];
}

export default function StepIndicator({ currentStep, totalSteps, steps }: StepIndicatorProps) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 sm:gap-4">
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const isCompleted = stepNumber < currentStep;
          const isCurrent = stepNumber === currentStep;

          return (
            <div key={step} className="flex items-center flex-1">
              {/* Circle */}
              <div
                className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-medium transition-all duration-200 ${
                  isCurrent
                    ? "bg-indigo-600 text-white shadow-lg scale-110"
                    : isCompleted
                    ? "bg-green-600 text-white"
                    : "bg-gray-200 text-gray-500"
                }`}
              >
                {isCompleted ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  stepNumber
                )}
              </div>

              {/* Label */}
              <div className="ml-3 hidden sm:block">
                <p className="text-sm font-medium text-gray-900">{step}</p>
              </div>

              {/* Line */}
              {stepNumber < totalSteps && (
                <div
                  className={`hidden sm:block flex-1 h-1 mx-4 rounded-full transition-all duration-200 ${
                    isCompleted ? "bg-green-600" : "bg-gray-200"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Mobile step label */}
      <div className="sm:hidden mt-4">
        <p className="text-sm text-gray-500">
          Paso {currentStep} de {totalSteps}
        </p>
        <p className="text-lg font-semibold text-gray-900">{steps[currentStep - 1]}</p>
      </div>
    </div>
  );
}
