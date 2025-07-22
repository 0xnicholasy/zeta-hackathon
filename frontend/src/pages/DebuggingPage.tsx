import React from 'react';
import { Spinner } from '@/components/ui/spinner';
import ThemeToggle from '@/components/ThemeToggle';
import * as deployments from '@/contracts/deployments';

const DebuggingPage = () => {
  const deploymentsObject = {
    networks: deployments.getAvailableNetworks(),
    deploymentInfo: deployments.getDeploymentInfo(),
    supportedChainIds: deployments.getSupportedChainIds(),
    supportedChain: deployments.SupportedChain,
    contractNames: deployments.CONTRACT_NAMES,
    tokenSymbols: deployments.TOKEN_SYMBOLS,
  };

  // Simple JSON syntax highlighter
  const highlightJson = (json: string): React.ReactElement => {
    return (
      <div className="whitespace-pre-wrap font-mono text-sm">
        {json.split('\n').map((line, index) => {
          const trimmedLine = line.trim();
          let className = 'text-foreground';

          // Determine line type and apply appropriate coloring
          if (trimmedLine.startsWith('"') && trimmedLine.includes('":')) {
            // Property name
            const parts = line.split('":');
            return (
              <div key={index}>
                <span className="text-blue-500 dark:text-blue-400">{parts[0]}":</span>
                <span className="text-foreground">{parts.slice(1).join('":')}</span>
              </div>
            );
          } else if (trimmedLine.startsWith('"') && trimmedLine.endsWith('",')) {
            // String value
            className = 'text-green-600 dark:text-green-400';
          } else if (trimmedLine.startsWith('"') && trimmedLine.endsWith('"')) {
            // String value (last in object)
            className = 'text-green-600 dark:text-green-400';
          } else if (/^\d+,?$/.test(trimmedLine)) {
            // Number value
            className = 'text-orange-600 dark:text-orange-400';
          } else if (trimmedLine === 'true,' || trimmedLine === 'false,' || trimmedLine === 'true' || trimmedLine === 'false') {
            // Boolean value
            className = 'text-purple-600 dark:text-purple-400';
          } else if (trimmedLine === 'null,' || trimmedLine === 'null') {
            // Null value
            className = 'text-red-600 dark:text-red-400';
          } else if (trimmedLine.includes('{') || trimmedLine.includes('}') || trimmedLine.includes('[') || trimmedLine.includes(']')) {
            // Brackets
            className = 'text-gray-600 dark:text-gray-400';
          }

          return (
            <div key={index} className={className}>
              {line}
            </div>
          );
        })}
      </div>
    );
  };

  const spinnerVariants = [
    { variant: 'default' as const, name: 'Default' },
    { variant: 'zeta' as const, name: 'Zeta' },
    { variant: 'secondary' as const, name: 'Secondary' },
    { variant: 'muted' as const, name: 'Muted' },
    { variant: 'accent' as const, name: 'Accent' },
    { variant: 'destructive' as const, name: 'Destructive' },
    { variant: 'white' as const, name: 'White' },
  ];

  const spinnerSizes = [
    { size: 'xs' as const, name: 'Extra Small' },
    { size: 'sm' as const, name: 'Small' },
    { size: 'default' as const, name: 'Default' },
    { size: 'lg' as const, name: 'Large' },
    { size: 'xl' as const, name: 'Extra Large' },
    { size: '2xl' as const, name: '2X Large' },
    { size: '3xl' as const, name: '3X Large' },
  ];

  const spinnerSpeeds = [
    { speed: 'slow' as const, name: 'Slow' },
    { speed: 'normal' as const, name: 'Normal' },
    { speed: 'fast' as const, name: 'Fast' },
  ];

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="border-b border-border pb-4">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold">Debugging Page</h1>
              <p className="text-muted-foreground mt-2">
                Debug deployments configuration and spinner components
              </p>
            </div>
            <div className="flex items-center gap-4">
              <ThemeToggle />
            </div>
          </div>
        </div>

        {/* Deployments Section */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Deployments Object</h2>
          <div className="bg-card rounded-lg border border-border p-6 overflow-auto">
            {highlightJson(JSON.stringify(deploymentsObject, null, 2))}
          </div>
        </section>

        {/* Spinner Variants Section */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Spinner Variants</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {spinnerVariants.map(({ variant, name }) => (
              <div key={variant} className="bg-card rounded-lg border border-border p-4 space-y-3">
                <h3 className="font-medium text-center">{name}</h3>
                <div className="flex justify-center">
                  <Spinner variant={variant} size="lg" />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Spinner Sizes Section */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Spinner Sizes</h2>
          <div className="bg-card rounded-lg border border-border p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
              {spinnerSizes.map(({ size, name }) => (
                <div key={size} className="text-center space-y-2">
                  <div className="font-medium text-sm">{name}</div>
                  <div className="flex justify-center">
                    <Spinner variant="zeta" size={size} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Spinner Speeds Section */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Spinner Speeds</h2>
          <div className="bg-card rounded-lg border border-border p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {spinnerSpeeds.map(({ speed, name }) => (
                <div key={speed} className="text-center space-y-3">
                  <div className="font-medium">{name}</div>
                  <div className="flex justify-center">
                    <Spinner variant="zeta" size="xl" speed={speed} text={`${name} speed`} textPosition="bottom" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Combined Examples Section */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Combined Examples</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-card rounded-lg border border-border p-6 text-center space-y-4">
              <h3 className="font-medium">Large Zeta with Text</h3>
              <Spinner variant="zeta" size="xl" text="Loading protocol..." textPosition="bottom" />
            </div>

            <div className="bg-card rounded-lg border border-border p-6 text-center space-y-4">
              <h3 className="font-medium">Fast White Spinner</h3>
              <div className="bg-slate-800 rounded p-4">
                <Spinner variant="white" size="lg" speed="fast" text="Processing..." textPosition="right" />
              </div>
            </div>

            <div className="bg-card rounded-lg border border-border p-6 text-center space-y-4">
              <h3 className="font-medium">Slow Destructive</h3>
              <Spinner variant="destructive" size="2xl" speed="slow" text="Error occurred" textPosition="bottom" />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default DebuggingPage;