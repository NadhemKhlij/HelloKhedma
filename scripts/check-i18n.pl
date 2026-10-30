# Lists t() / tn() texts in js/*.js that have no French in js/i18n-fr.js. Usage (Git Bash, repo root): perl scripts/check-i18n.pl js
# Lists t()/tn() literal keys in js/*.js that are missing from js/i18n-fr.js.
local $/;
my $dir = shift;
my $str = qr/"((?:[^"\x5c]|\x5c.)*)"/;
open F, "$dir/i18n-fr.js" or die; my $s = <F>;
my %d; while ($s =~ /^\s*$str:/mg) { $d{$1} = 1 }
print scalar(keys %d), " keys\n";
for my $f (glob "$dir/*.js") { next if $f =~ /i18n/; open G, $f; my $c = <G>;
  while ($c =~ /\bt\($str/g) { print "$f: $1\n" unless $d{$1} }
  while ($c =~ /\btn\([^,]+,\s*$str,\s*$str/g) { for ($1, $2) { print "$f: $_\n" unless $d{$_} } }
}
