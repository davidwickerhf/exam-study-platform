% Problem:  Evaluate polynomial using 3-digit arithmetic in nested form.
% Topic:    Computer Arithmetic (1) / Slide 45/76
% Author:   M. Boussé
% Version:  29/03/2022

wipe;

format long

%% Define a short-hand function for rounding

r = @(x) round(x,3,'significant')';

%% Define polynomial and evaluation point

c = [1.0, -5.34, 1.52, 4.61];
x = 4.89;
%% direct evaluation (using double precision)
fdirect = @(x) c(1)*x^3 + c(2)*x^2 + c(3)*x + c(4);
fdirect(x)

% note: we don't use polyval because it uses Horner  internally!)

%% nested evaluation (using double precision)

fnested = @(x) ((c(1)*x+c(2))*x+c(3))*x+c(4);
fnested(x)

% note: this is the same result as polyval
% fnested(x) - polyval(c,x)

%% direct evaluation using 3-digit rounding

fdirectrounded = @(x) r(r(r(r(r(x*x)*x)+r(c(2)*r(x*x)))+r(c(3)*x))+c(4));
fdirectrounded(x)

%% nested evaluation using 3-digit rounding
fnestedrounded = @(x) r(r(r(r(r(x-5.34)*x)+1.52)*x)+4.61);
fnestedrounded(x)