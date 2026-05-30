% Problem:  Chebyshev nodes
% Topic:    Polynomial Interpolation (3) / Slide 48/73
% Author:   M. Boussé, P. Collins
% Version:  13/04/2022

clear variables; close all; clc;

%% 

f = @(x) 1./(1+x.^2);
a = 4;
n = 16; % degree: show 8, 16, 32
xs = -a*cos((2*[0:n]+1)*pi/(2*n+2));
ys = f(xs);

figure, 
fplot(f,[-a,a],'k--'), hold on;
plot(xs,ys,'s');

%% compute fit 

cs = polyfit(xs,ys,n);
p = @(x) polyval(cs,x);

%% plot polynomial

hold on, fplot(p,[-a,a],'b'), hold off;
legend('True','Nodes','Interpolant')

error = max(abs(f([-a:0.1:a]) - p([-a:0.1:a])))
% note: error decreases as degree increases


