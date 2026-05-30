% Problem:  Reducing errors in scientific computing: Subtraction
% Topic:    Computer Arithmetic (1) / Slide 41/76
% Author:   M. Boussé
% Version:  29/03/2022

wipe;

%% double precision (= exact, in this case)

x = 427;
y = 426;

r_double = x^3 - y^3

%% single precision

r_single = single(x)^3 - single(y)^3

abs(r_single - r_double)/r_double

%% single precision + rewrite

r_single2 = (single(x)-single(y))*(single(x)^2 + single(x)*single(y) + single(y)^2)

abs(r_single2 - r_double)/r_double

% note: the answer is exact!

